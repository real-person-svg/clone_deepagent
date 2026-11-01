import type { ModelMessage, ModelReply, Run } from '../../contracts/index';
import { Tools } from '../../research/tools';
import { Store, now, uid } from '../../storage/index';
import { selectContext } from '../context';
import { HttpModel, type LiveModelConfig, type ModelAdapter } from '../model';
import { type Checkpoint } from './checkpoint';
import { conversationContext } from './conversation-context';
import { assertRunOwner } from './lease';
import { executePendingTools } from './pending-tools';
import { Slots } from './slots';
export class AgentRunner {
  private modelSlots = new Slots(3);
  private childSlots = new Slots(3);
  constructor(
    private store: Store,
    private tools: Tools,
    private live?: LiveModelConfig,
    private adapters?: Partial<Record<'live', ModelAdapter>>
  ) {}
  private assertOwner(id: string, owner: string, signal: AbortSignal) {
    assertRunOwner(this.store, id, owner, signal);
  }
  async run(
    run: Run,
    taskKey: string,
    agentId: string,
    goal: string,
    owner: string,
    signal: AbortSignal
  ): Promise<string> {
    this.assertOwner(run.id, owner, signal);
    const agent = run.snapshot[agentId];
    if (!agent) throw new Error('当前运行快照没有目标 Agent');
    const taskId = `${run.id}_${taskKey}`;
    this.store.exec(
      'INSERT OR IGNORE INTO tasks VALUES(?,?,?,?,?,?,?,?,?)',
      taskId,
      run.id,
      taskKey,
      agentId,
      'queued',
      null,
      null,
      now(),
      now()
    );
    const saved = this.store.checkpoint<Checkpoint>(run.id, taskKey);
    if (saved?.final !== undefined) {
      this.store.exec(
        "UPDATE tasks SET status='completed',result=?,error=NULL,updatedAt=? WHERE id=?",
        saved.final,
        now(),
        taskId
      );

      return saved.final;
    }
    const state: Checkpoint = saved || {
      messages: conversationContext(this.store, run, goal),
      step: 0,
      pending: [],
    };
    this.store.tx(() => {
      this.store.exec(
        "UPDATE tasks SET status='running',error=NULL,updatedAt=? WHERE id=?",
        now(),
        taskId
      );
      this.store.event(run.id, 'agent.started', agentId, {
        taskKey,
        goal,
        version: agent.version,
        agentName: agent.name,
        restored: Boolean(saved),
      });
      this.store.saveCheckpoint(run.id, taskKey, state);
    });
    const pinnedTask = state.messages.findLast(
      (m) => m.role === 'user' && m.content?.includes('本轮研究上下文：')
    );
    const allowed = agent.tools.filter(
      (n) => n !== 'delegate_tasks' || (taskKey === 'root' && run.mode === 'multi')
    );
    let adapter = this.adapters?.[run.provider];
    if (!adapter && this.live) adapter = new HttpModel(this.live);
    if (!adapter) throw new Error('真实模型尚未配置，请在服务端设置 MODEL_BASE_URL 和 MODEL_NAME');
    try {
      while (state.step < agent.maxSteps) {
        this.assertOwner(run.id, owner, signal);
        if (state.pending.length) {
          await executePendingTools({
            store: this.store,
            tools: this.tools,
            run,
            state,
            taskKey,
            agentId,
            allowed,
            owner,
            signal,
            delegate: (tasks, callId) => this.delegate(run, tasks, callId, owner, signal),
          });
          continue;
        }
        const requests = this.store.get<{ n: number }>(
          'SELECT count(*) n FROM usage_records WHERE runId=?',
          run.id
        )!.n;
        if (requests >= 60) throw new Error('已达到本次研究的总模型请求预算');
        const usageId = uid('usage');
        this.store.exec(
          'INSERT INTO usage_records VALUES(?,?,?,?,?,?,?)',
          usageId,
          run.id,
          agentId,
          run.provider,
          0,
          0,
          now()
        );
        this.store.event(run.id, 'model.started', agentId, {
          taskKey,
          step: state.step + 1,
          provider: run.provider,
        });
        let text = '',
          pendingText = '',
          lastFlush = Date.now();

        const flushText = () => {
          if (!pendingText) return;
          this.assertOwner(run.id, owner, signal);
          this.store.event(run.id, taskKey === 'root' ? 'message.delta' : 'agent.delta', agentId, {
            taskKey,
            step: state.step + 1,
            text: pendingText,
          });
          pendingText = '';
          lastFlush = Date.now();
        };
        const context = selectContext(state.messages, 75000, pinnedTask);
        if (context.compacted)
          this.store.event(run.id, 'context.compacted', agentId, {
            taskKey,
            originalCharacters: context.originalCharacters,
            selectedCharacters: JSON.stringify(context.messages).length,
            message: '已选择近期完整工具调用对，旧记录仍可查询',
          });
        const reply: ModelReply = await this.modelSlots.use(signal, () =>
          adapter.complete({
            agent,
            messages: context.messages,
            tools: this.tools.definitions(allowed),
            signal,
            onText: (delta) => {
              this.assertOwner(run.id, owner, signal);
              text += delta;
              pendingText += delta;
              if (pendingText.length >= 100 || Date.now() - lastFlush > 80) flushText();
            },
          })
        );
        this.assertOwner(run.id, owner, signal);
        flushText();
        if (reply.usage)
          this.store.exec(
            'UPDATE usage_records SET inputTokens=?,outputTokens=? WHERE id=?',
            reply.usage.input,
            reply.usage.output,
            usageId
          );
        state.step++;
        if (reply.toolCalls.length) {
          const message: ModelMessage = {
            role: 'assistant',
            content: reply.content || null,
            tool_calls: reply.toolCalls,
          };
          if (reply.reasoningContent !== undefined)
            message.reasoning_content = reply.reasoningContent;
          state.messages.push(message);
          state.pending = reply.toolCalls;
          this.store.saveCheckpoint(run.id, taskKey, state);
        } else {
          const content = reply.content || text;
          if (!content.trim()) throw new Error('模型没有返回可用回答');
          if (taskKey === 'root') {
            const eligible = new Set(
              this.store
                .all<{
                  evidenceId: string;
                }>('SELECT evidenceId FROM run_evidence WHERE runId=?', run.id)
                .map((e) => e.evidenceId)
            );
            const invalid = [...content.matchAll(/\]\(\/evidence\/([\w-]+)\)/g)]
              .map((match) => match[1])
              .filter((id) => !eligible.has(id));
            if (invalid.length && !state.citationRepairs && state.step < agent.maxSteps) {
              state.citationRepairs = 1;
              const repairMessage: ModelMessage = { role: 'assistant', content };
              if (reply.reasoningContent !== undefined)
                repairMessage.reasoning_content = reply.reasoningContent;
              state.messages.push(repairMessage, {
                role: 'user',
                content: `系统引用校验未通过：${[...new Set(invalid)].join('、')}不是已保存证据ID。请修正上一份回答，只引用工具结果中实际返回的id；工具名称和空查询结果没有证据ID。没有可引用证据时去掉引用并标记未知。此步骤不更改用户需求，不得补造事实。`,
              });
              this.store.saveCheckpoint(run.id, taskKey, state);
              this.store.event(run.id, 'citation.repair_requested', agentId, {
                taskKey,
                invalidIds: [...new Set(invalid)],
                attempt: 1,
              });
              continue;
            }
            if (invalid.length) throw new Error('引用修正后仍存在无效证据，已阻止发布');
          }
          state.final = content;
          state.finalReasoningContent = reply.reasoningContent;
          this.store.tx(() => {
            this.store.saveCheckpoint(run.id, taskKey, state);
            this.store.exec(
              "UPDATE tasks SET status='completed',result=?,error=NULL,updatedAt=? WHERE id=?",
              content,
              now(),
              taskId
            );
            this.store.event(run.id, 'agent.completed', agentId, {
              taskKey,
              result: content,
              steps: state.step,
            });
          });

          return content;
        }
      }
      throw new Error(`${agent.name} 达到 ${agent.maxSteps} 步上限，已停止继续调用`);
    } catch (error) {
      this.store.exec(
        "UPDATE tasks SET status='failed',error=?,updatedAt=? WHERE id=?",
        error instanceof Error ? error.message : '执行失败',
        now(),
        taskId
      );
      this.store.event(run.id, 'agent.failed', agentId, {
        taskKey,
        error: error instanceof Error ? error.message : '执行失败',
      });
      throw error;
    }
  }

  private async delegate(
    run: Run,
    tasks: { agent: string; goal: string }[],
    callId: string,
    owner: string,
    signal: AbortSignal
  ) {
    if (
      tasks.some(
        (t) => !['research', 'pricing', 'product', 'strategy', 'verifier'].includes(t.agent)
      )
    )
      throw new Error('只能委派已发布的业务 Agent');
    this.store.tx(() => {
      this.store.exec(
        "UPDATE runs SET status='waiting_children' WHERE id=? AND owner=?",
        run.id,
        owner
      );
      this.store.event(run.id, 'task.delegated', 'root', { tasks });
    });
    try {
      const results = await Promise.allSettled(
        tasks.map((t, i) =>
          this.childSlots.use(signal, async () => {
            const previous = this.store
              .all<{ agent: string; result: string }>(
                "SELECT agent,result FROM tasks WHERE runId=? AND status='completed' AND taskKey!='root' ORDER BY createdAt",
                run.id
              )
              .map((r) => `${r.agent}: ${r.result.slice(0, 7000)}`)
              .join('\n\n');
            const key = `${callId}_${t.agent}_${i}`;
            const result = await this.run(
              run,
              key,
              t.agent,
              `${t.goal}\n\n已完成的子任务结果（作为资料参考）：\n${previous}`,
              owner,
              signal
            );

            return { agent: t.agent, name: run.snapshot[t.agent].name, taskKey: key, result };
          })
        )
      );

      return {
        tasks: results.map((result, index) => {
          if (result.status === 'fulfilled') return result.value;
          const task = tasks[index];
          const reason = result.reason instanceof Error ? result.reason.message : '执行失败';

          return {
            agent: task.agent,
            name: run.snapshot[task.agent].name,
            result: `子任务未完成：${reason}`,
            status: 'failed',
          };
        }),
      };
    } finally {
      this.store.exec("UPDATE runs SET status='running' WHERE id=? AND owner=?", run.id, owner);
    }
  }
}
