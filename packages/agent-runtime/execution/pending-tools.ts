import type { Run } from '../../contracts/index';
import type { Tools } from '../../research/tools';
import { Store, now, parse } from '../../storage/index';
import { operationKey, type Checkpoint } from './checkpoint';
import { assertRunOwner } from './lease';
interface PendingTools {
  store: Store;
  tools: Tools;
  run: Run;
  state: Checkpoint;
  taskKey: string;
  agentId: string;
  allowed: string[];
  owner: string;
  signal: AbortSignal;
  delegate: (tasks: { agent: string; goal: string }[], callId: string) => Promise<unknown>;
}
export async function executePendingTools({
  store,
  tools,
  run,
  state,
  taskKey,
  agentId,
  allowed,
  owner,
  signal,
  delegate,
}: PendingTools) {
  for (const toolCall of [...state.pending]) {
    assertRunOwner(store, run.id, owner, signal);
    const total = store.get<{ n: number }>(
      'SELECT count(*) n FROM tool_calls WHERE runId=?',
      run.id
    )!.n;
    if (total >= 60) throw new Error('已达到本次研究的总工具预算');
    const operationId = operationKey(run.id, taskKey, toolCall.id);
    const prior = store.get<{ result: string; status: string }>(
      'SELECT result,status FROM tool_calls WHERE id=?',
      operationId
    );
    let result: unknown;
    if (prior?.status === 'completed') result = parse(prior.result, {});
    else {
      const args = parse<Record<string, unknown>>(toolCall.function.arguments, {});
      store.tx(() => {
        store.exec(
          'INSERT INTO tool_calls VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,updatedAt=excluded.updatedAt',
          operationId,
          run.id,
          taskKey,
          toolCall.function.name,
          JSON.stringify(args),
          null,
          'running',
          now(),
          now()
        );
        store.event(run.id, 'tool.started', agentId, {
          taskKey,
          callId: toolCall.id,
          name: toolCall.function.name,
          args,
        });
      });
      try {
        const data = await tools.execute(
          toolCall.function.name,
          args,
          {
            runId: run.id,
            taskKey,
            conversationId: run.conversationId,
            provider: run.provider,
            dataset: run.dataset,
            signal,
            delegate:
              agentId === 'root' && run.mode === 'multi'
                ? (tasks) => delegate(tasks, toolCall.id)
                : undefined,
          },
          allowed
        );
        result = { ok: true, data };
      } catch (error) {
        if (signal.aborted) throw error;
        result = {
          ok: false,
          error: error instanceof Error ? error.message : '工具执行失败',
        };
      }
      assertRunOwner(store, run.id, owner, signal);
      store.tx(() => {
        store.exec(
          "UPDATE tool_calls SET status='completed',result=?,updatedAt=? WHERE id=?",
          JSON.stringify(result),
          now(),
          operationId
        );
        store.event(run.id, 'tool.completed', agentId, {
          taskKey,
          callId: toolCall.id,
          name: toolCall.function.name,
          result: result as Record<string, unknown>,
        });
      });
    }
    store.tx(() => {
      state.messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: toolCall.id,
      });
      state.pending = state.pending.filter((c) => c.id !== toolCall.id);
      store.saveCheckpoint(run.id, taskKey, state);
    });
  }
}
