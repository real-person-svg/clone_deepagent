import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { selectContext } from '../packages/agent-runtime/context';
import type { ModelAdapter } from '../packages/agent-runtime/model';
import { operationKey, Runtime } from '../packages/agent-runtime/runtime';
import { initializeAgents } from '../packages/research/agents';
import { addSource, evidenceAdapter } from './support';
import { normalizePricing } from '../packages/research/pricing';
import { isPublicIpv4 } from '../packages/research/sources/public-page';
import { Subscriptions } from '../packages/research/subscriptions';
import { now, Store } from '../packages/storage/index';

const resources: { store: Store; runtime: Runtime; dir: string }[] = [];
function setup(adapter?: ModelAdapter) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-studio-'));
  const store = new Store(join(dir, 'test.sqlite'));
  initializeAgents(store);
  const runtime = new Runtime(store, undefined, { live: adapter || evidenceAdapter });
  resources.push({ store, runtime, dir });
  return { store, runtime, dir };
}
afterEach(async () => {
  for (const r of resources.splice(0)) {
    await r.runtime.stop();
    r.store.close();
    rmSync(r.dir, { recursive: true, force: true });
  }
});

describe('确定性定价规则', () => {
  it('保留年付承诺与最低席位，不将月均价格当月付', () => {
    const plan = {
      competitor: '协议测试产品',
      plan: '测试套餐',
      amount: '120',
      currency: 'USD',
      billingPeriod: 'year' as const,
      unit: 'seat' as const,
      minimumSeats: 3,
      quota: '未知',
      commercialRights: '未知',
      api: '未知',
      evidenceId: 'test',
    };
    const [price] = normalizePricing([plan], 2);
    expect(price.monthlyEquivalent).toBe('10.00');
    expect(price.teamMonthly).toBe('30.00');
    expect(price.annualTotal).toBe('360.00');
    expect(price.conditions).toContain('按年付款');
    expect(() => normalizePricing([plan], 0)).toThrow();
  });
});
describe('完整单 Agent ReAct 与 SQLite 历史链路', () => {
  it('厂商续轮字段保留在checkpoint并用于后续请求，不进入聊天输出或事件', async () => {
    let calls = 0;
    const { store, runtime } = setup({
      complete: async (req) => {
        calls++;
        if (calls === 1)
          return {
            content: '',
            reasoningContent: 'opaque-tool-state',
            toolCalls: [
              {
                id: 'opaque-call',
                type: 'function',
                function: { name: 'list_competitors', arguments: '{}' },
              },
            ],
          };
        if (calls === 2) {
          expect(req.messages.find((m) => m.tool_calls)?.reasoning_content).toBe(
            'opaque-tool-state'
          );
          return { content: '价格未知。', reasoningContent: 'opaque-final-state', toolCalls: [] };
        }
        expect(req.messages.some((m) => m.reasoning_content === 'opaque-final-state')).toBe(true);
        return { content: '继续保持未知。', toolCalls: [] };
      },
    });
    const first = store.createRun({
      prompt: '查证价格',
      mode: 'single',
      provider: 'live',
    });
    runtime.start();
    await runtime.idle();
    store.createRun({
      conversationId: first.conversationId,
      prompt: '继续',
      mode: 'single',
      provider: 'live',
    });
    await runtime.idle();
    expect(calls).toBe(3);
    expect(JSON.stringify(store.events(first.id))).not.toContain('opaque-tool-state');
    expect(JSON.stringify(store.events(first.id))).not.toContain('opaque-final-state');
    expect(store.run(first.id).answer).not.toContain('opaque-');
  });
  it('历史检索支持分开的关键词及向前分页，可找回近期窗口外的完整用户约束', async () => {
    const { store, runtime } = setup();
    let conversationId: string | undefined;
    for (let i = 0; i < 6; i++) {
      const r = store.createRun({
        conversationId,
        prompt:
          i === 0
            ? `${'背景'.repeat(500)}最终预算800元，5人团队，项目代号JY-KEEP`
            : `预算核对第${i}轮`,
        mode: 'single',
        provider: 'live',
      });
      conversationId = r.conversationId;
      store.finish(r.id, 'completed', `预算已核对第${i}轮`);
    }
    const current = store.createRun({
      conversationId,
      prompt: '查询早期约束',
      mode: 'single',
      provider: 'live',
    });
    const context = {
      runId: current.id,
      taskKey: 'root',
      conversationId: conversationId!,
      provider: 'live' as const,

      signal: new AbortController().signal,
    };
    const first = (await runtime.tools.execute('search_history', { query: '预算 5人' }, context, [
      'search_history',
    ])) as { messages: { content: string }[]; nextOffset: number };
    expect(first.messages).toHaveLength(8);
    expect(first.nextOffset).toBe(8);
    const older = (await runtime.tools.execute(
      'search_history',
      { query: '预算 5人', offset: first.nextOffset },
      context,
      ['search_history']
    )) as { messages: { content: string }[] };
    expect(older.messages.some((m) => m.content.includes('JY-KEEP'))).toBe(true);
  });
  it('真实模型编造引用时允许一次修正，修正前不发布报告', async () => {
    let calls = 0;
    const { store, runtime } = setup({
      complete: async () => ({
        content: ++calls === 1 ? '未知 [来源](/evidence/list_competitors)' : '没有来源，价格未知。',
        toolCalls: [],
      }),
    });
    const r = store.createRun({
      prompt: '检查价格',
      mode: 'single',
      provider: 'live',
    });
    runtime.start();
    await runtime.idle();
    expect(calls).toBe(2);
    expect(store.run(r.id).status).toBe('partial');
    expect(store.run(r.id).answer).not.toContain('/evidence/list_competitors');
    expect(store.events(r.id).filter((e) => e.type === 'citation.repair_requested')).toHaveLength(
      1
    );
    expect(store.reports()).toHaveLength(1);
  });
  it('引用修正有上限，不重复重试或发布无效报告', async () => {
    let calls = 0;
    const { store, runtime } = setup({
      complete: async () => {
        calls++;
        return { content: '[来源](/evidence/invented)', toolCalls: [] };
      },
    });
    const r = store.createRun({
      prompt: '检查价格',
      mode: 'single',
      provider: 'live',
    });
    runtime.start();
    await runtime.idle();
    expect(calls).toBe(2);
    expect(store.run(r.id).status).toBe('failed');
    expect(store.reports()).toHaveLength(0);
  });
  it('已有证据未经本轮工具读取也不能被直接引用', async () => {
    const { store, runtime } = setup({
      complete: async () => ({ content: '[未读取来源](/evidence/source_test)', toolCalls: [] }),
    });
    addSource(store);
    const run = store.createRun({ prompt: '核验引用', mode: 'single', provider: 'live' });
    runtime.start();
    await runtime.idle();
    expect(store.run(run.id).status).toBe('failed');
    expect(store.reports()).toHaveLength(0);
  });
  it('真正执行工具、保存 checkpoint、生成带引用报告并能重新打开数据库', async () => {
    const { store, runtime, dir } = setup();
    addSource(store);
    const run = store.createRun({
      prompt: '按 3 人团队比较定价',
      mode: 'single',
      provider: 'live',
    });
    runtime.start();
    await runtime.idle();
    expect(store.run(run.id).status).toBe('completed');
    expect(store.run(run.id).answer).toContain('每年 USD 120');
    expect(store.all('SELECT * FROM tool_calls WHERE runId=?', run.id)).toHaveLength(1);
    expect(store.events(run.id).some((e) => e.type === 'message.delta')).toBe(true);
    expect(store.checkpoint<{ final: string }>(run.id, 'root')?.final).toContain('/evidence/');
    const anotherConnection = new Store(join(dir, 'test.sqlite'));
    const detail = anotherConnection.detail(run.conversationId);
    expect(detail.messages).toHaveLength(2);
    expect(detail.reports).toHaveLength(1);
    expect(detail.messages[1].content).toBe(store.run(run.id).answer);
    anotherConnection.close();
  });
  it('恢复已提交工具结果而不重复执行', async () => {
    let toolMessages = 0;
    const { store, runtime } = setup({
      complete: async (req) => {
        toolMessages = req.messages.filter((m) => m.role === 'tool').length;
        return { content: '恢复后的分析（资料不足）', toolCalls: [] };
      },
    });
    const r = store.createRun({
      prompt: '恢复工具执行',
      mode: 'single',
      provider: 'live',
    });
    const call = {
      id: 'saved_call',
      type: 'function' as const,
      function: { name: 'query_evidence', arguments: '{}' },
    };
    store.saveCheckpoint(r.id, 'root', {
      messages: [
        { role: 'user', content: r.prompt },
        { role: 'assistant', content: null, tool_calls: [call] },
      ],
      pending: [call],
      step: 1,
    });
    store.exec(
      'INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?)',
      `${r.id}_root`,
      r.id,
      'root',
      'root',
      'failed',
      null,
      'old interruption',
      now(),
      now()
    );
    store.exec(
      'INSERT INTO tool_calls VALUES(?,?,?,?,?,?,?,?,?)',
      operationKey(r.id, 'root', call.id),
      r.id,
      'root',
      'query_evidence',
      '{}',
      JSON.stringify({ ok: true, data: { sources: [] } }),
      'completed',
      now(),
      now()
    );
    runtime.start();
    await runtime.idle();
    expect(toolMessages).toBe(1);
    expect(store.all('SELECT * FROM tool_calls WHERE runId=?', r.id)).toHaveLength(1);
    expect(store.events(r.id).filter((e) => e.type === 'tool.started')).toHaveLength(0);
    expect(store.run(r.id).status).toBe('partial');
    expect(
      store.get<{ error: string | null }>('SELECT error FROM tasks WHERE runId=?', r.id)?.error
    ).toBeNull();
  });
  it('执行中取消不会发布成功报告', async () => {
    const { store, runtime } = setup({
      complete: (req) =>
        new Promise((_resolve, reject) => {
          req.signal.addEventListener('abort', () => reject(new Error('cancelled')), {
            once: true,
          });
        }),
    });
    const r = store.createRun({
      prompt: '慢速模型任务',
      mode: 'single',
      provider: 'live',
    });
    runtime.start();
    await new Promise((resolve) => setTimeout(resolve, 30));
    runtime.cancel(r.id);
    await runtime.idle();
    expect(store.run(r.id).status).toBe('cancelled');
    expect(store.reports()).toHaveLength(0);
  });
  it('在途执行固定发布快照；过期草稿修订拒绝覆盖', () => {
    const { store } = setup();
    const r = store.createRun({
      prompt: '固定版本',
      mode: 'single',
      provider: 'live',
    });
    const agent = store.agents()[0];
    store.saveAgent(agent.id, '新职责配置', agent.draftRevision, true);
    expect(store.run(r.id).snapshot.root.version).toBe(3);
    expect(store.agents()[0].version).toBe(4);
    expect(() => store.saveAgent(agent.id, '旧请求', agent.draftRevision, true)).toThrow(
      '配置已更新'
    );
  });
  it('不同运行复用模型 tool call ID 时，不会误用其他任务的结果', async () => {
    const { store, runtime } = setup({
      complete: async (req) => {
        const tool = req.messages.find((m) => m.role === 'tool');
        if (tool) {
          const source = JSON.parse(tool.content || '{}').data.sources[0];
          return { content: `${source.competitor} [原文](/evidence/${source.id})`, toolCalls: [] };
        }
        const competitor = req.messages.at(-1)!.content!.includes('测试产品一')
          ? '测试产品一'
          : '测试产品二';
        return {
          content: '',
          toolCalls: [
            {
              id: 'provider_reused_id',
              type: 'function',
              function: { name: 'query_evidence', arguments: JSON.stringify({ competitor }) },
            },
          ],
        };
      },
    });
    for (const name of ['测试产品一', '测试产品二'])
      store.putEvidence({
        id: `real_${name}`,
        competitor: name,
        title: `${name} 原文`,
        url: '',
        content: `${name} 用户上传资料`,
        kind: 'upload',

        observedAt: now(),
        hash: name,
        metadata: {},
      });
    runtime.start();
    const a = store.createRun({
      prompt: '研究 测试产品一',
      mode: 'single',
      provider: 'live',
    });
    await runtime.idle();
    const b = store.createRun({
      prompt: '研究 测试产品二',
      mode: 'single',
      provider: 'live',
    });
    await runtime.idle();
    expect(store.run(a.id).answer).toContain('测试产品一');
    expect(store.run(b.id).answer).toContain('测试产品二');
    expect(store.all("SELECT * FROM tool_calls WHERE name='query_evidence'")).toHaveLength(2);
  });
  it('崩溃后的过期租约从已提交回答恢复并完成报告', async () => {
    const { store, runtime } = setup();
    addSource(store);
    const r = store.createRun({
      prompt: '恢复研究',
      mode: 'single',
      provider: 'live',
    });
    store.exec('INSERT INTO run_evidence VALUES(?,?)', r.id, 'source_test');
    store.saveCheckpoint(r.id, 'root', {
      messages: [],
      step: 3,
      pending: [],
      final: '已提交的结论 [原始来源](/evidence/source_test)',
    });
    store.exec(
      "UPDATE runs SET status='running',owner='dead_process',leaseUntil='2000-01-01T00:00:00.000Z' WHERE id=?",
      r.id
    );
    runtime.start();
    await runtime.idle();
    expect(store.run(r.id).status).toBe('completed');
    expect(store.reports()).toHaveLength(1);
    expect(store.events(r.id).some((e) => e.type === 'run.recovered')).toBe(true);
    expect(
      store.get<{ status: string }>('SELECT status FROM tasks WHERE runId=?', r.id)?.status
    ).toBe('completed');
  });
});

describe('多 Agent、发布订阅与崩溃后的告警补偿', () => {
  it('订阅固定已发布任务模板与 Agent 版本，新发布只影响新订阅', () => {
    const { store } = setup();
    const service = new Subscriptions(store, () => true);
    addSource(store, { kind: 'web', url: 'https://public.example/pricing' });
    const template = service.saveTemplate({
      name: '商业化观察',
      prompt: '比较定价与授权',
      publish: true,
    });
    const old = service.create({
      templateId: template.id,
      name: '旧版本订阅',
      prompt: '观察变化',
      intervalMinutes: 1440,
      sourceIds: ['source_test'],
    });
    const root = store.agents()[0];
    store.saveAgent(root.id, '更新的主 Agent 职责', root.draftRevision, true);
    service.saveTemplate({
      id: template.id,
      revision: template.draftRevision,
      name: template.name,
      prompt: '新的研究要求',
      publish: true,
    });
    const latest = service.create({
      templateId: template.id,
      name: '新版本订阅',
      prompt: '观察变化',
      intervalMinutes: 1440,
      sourceIds: ['source_test'],
    });
    expect(service.trigger(old.id).snapshot.root.version).toBe(3);
    expect(service.trigger(latest.id).snapshot.root.version).toBe(4);
    expect(old.templateVersion).toBe(1);
    expect(latest.templateVersion).toBe(2);
  });
  it('多 Agent 使用真实资料工具，保存子任务结果与引用', async () => {
    const { store, runtime } = setup({
      complete: async (req) => {
        const tool = req.messages.filter((m) => m.role === 'tool').at(-1);
        if (req.agent.id === 'root' && !tool)
          return {
            content: '',
            toolCalls: [
              {
                id: 'delegate',
                type: 'function',
                function: {
                  name: 'delegate_tasks',
                  arguments: JSON.stringify({
                    tasks: [
                      { agent: 'research', goal: '核对原文' },
                      { agent: 'verifier', goal: '核验引用' },
                    ],
                  }),
                },
              },
            ],
          };
        if (req.agent.id === 'root')
          return { content: '综合结论 [原文](/evidence/source_test)', toolCalls: [] };
        return evidenceAdapter.complete(req);
      },
    });
    addSource(store);
    const r = store.createRun({ prompt: '协作研究', mode: 'multi', provider: 'live' });
    runtime.start();
    await runtime.idle();
    expect(store.run(r.id).status).toBe('completed');
    expect(
      store.all("SELECT * FROM tasks WHERE runId=? AND status='completed'", r.id)
    ).toHaveLength(3);
    expect(store.reports()[0].evidenceIds).toEqual(['source_test']);
  });
});

it('拒绝 URL 抓取本机、内网、链路本地与保留 IPv4 地址', () => {
  for (const address of [
    '127.0.0.1',
    '10.1.1.1',
    '172.16.1.1',
    '192.168.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
  ])
    expect(isPublicIpv4(address)).toBe(false);
  expect(isPublicIpv4('1.1.1.1')).toBe(true);
});
it('长上下文选择保留完整工具调用/结果对和当前任务', () => {
  const history = [
    { role: 'user' as const, content: '旧问题'.repeat(3000) },
    { role: 'assistant' as const, content: '旧报告'.repeat(3000) },
    { role: 'user' as const, content: '当前任务：保留年付条件' },
  ];
  const pairs = Array.from({ length: 8 }, (_, n) => [
    {
      role: 'assistant' as const,
      content: null,
      tool_calls: [
        {
          id: `call_${n}`,
          type: 'function' as const,
          function: { name: 'query_evidence', arguments: '{}' },
        },
      ],
    },
    { role: 'tool' as const, tool_call_id: `call_${n}`, content: '证据'.repeat(1000) },
  ]).flat();
  const result = selectContext([...history, ...pairs], 15000);
  expect(result.compacted).toBe(true);
  expect(result.messages.some((m) => m.content === '当前任务：保留年付条件')).toBe(true);
  for (const tool of result.messages.filter((m) => m.role === 'tool'))
    expect(result.messages.some((m) => m.tool_calls?.some((c) => c.id === tool.tool_call_id))).toBe(
      true
    );
});
