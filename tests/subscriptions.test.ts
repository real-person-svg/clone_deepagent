import { afterEach, expect, it, vi } from 'vitest';
import { Runtime } from '../packages/agent-runtime/runtime';
import { initializeAgents } from '../packages/research/agents';
import { Subscriptions } from '../packages/research/subscriptions';
import * as pages from '../packages/research/sources/public-page';
import { Store } from '../packages/storage/index';
import { addSource, evidenceAdapter } from './support';
const resources: { store: Store; runtime: Runtime; service: Subscriptions }[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const { store, runtime, service } of resources.splice(0)) {
    service.stop();
    await runtime.stop();
    store.close();
  }
});
function setup() {
  const store = new Store(':memory:');
  initializeAgents(store);
  const runtime = new Runtime(store, undefined, { live: evidenceAdapter });
  const service = new Subscriptions(store, () => runtime.liveConfigured);
  resources.push({ store, runtime, service });
  addSource(store, { kind: 'web', url: 'https://public.example/pricing' });
  const sub = service.create({
    name: '来源观察',
    prompt: '核对来源更新',
    intervalMinutes: 1440,
    sourceIds: ['source_test'],
  });
  return { store, runtime, service, sub };
}
it('每次巡检真正刷新所选来源，完成后推进基线，重复触发和无变化均不重复通知', async () => {
  const { store, runtime, service, sub } = setup();
  const fetch = vi.spyOn(pages, 'fetchPublicPage').mockResolvedValue({
    url: 'https://public.example/pricing',
    title: '协议测试来源',
    text: '页面新的原文，尚需分析商业化含义。',
  });
  addSource(store, {
    id: 'unselected',
    competitor: '不在巡检范围的产品',
    kind: 'web',
    url: 'https://other.example/',
  });
  const run = service.trigger(sub.id, 'one');
  expect(service.trigger(sub.id, 'one').id).toBe(run.id);
  runtime.start();
  await runtime.idle();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(store.run(run.id).status).toBe('completed');
  expect(store.reports()[0].evidenceIds).not.toContain('unselected');
  // Restart reconciliation works even without the in-process completion callback.
  service.tick();
  service.tick();
  expect(store.notifications()).toHaveLength(1);
  expect(store.notifications()[0].title).toContain('来源内容更新');
  const baseline = service.find(sub.id).baseline;
  expect(baseline.source_test).not.toBe('source_test');
  service.trigger(sub.id, 'two');
  await runtime.idle();
  service.tick();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(service.find(sub.id).baseline).toEqual(baseline);
  expect(store.notifications()).toHaveLength(1);
});
it('任一来源采集失败时不调用模型、不推进基线；通知一次并可重试', async () => {
  const { store, runtime, service, sub } = setup();
  vi.spyOn(pages, 'fetchPublicPage').mockRejectedValue(new Error('HTTP 403'));
  runtime.onComplete = (r) => service.process(r);
  const run = service.trigger(sub.id);
  runtime.start();
  await runtime.idle();
  service.tick();
  expect(store.run(run.id).status).toBe('failed');
  expect(store.all('SELECT * FROM usage_records')).toHaveLength(0);
  expect(service.find(sub.id).baseline).toEqual({ source_test: 'source_test' });
  expect(store.notifications()).toHaveLength(1);
  expect(store.notifications()[0].title).toContain('检查未完成');
});
it('模型没有证据引用时保留旧基线并通知部分结果', async () => {
  const { store, runtime, service, sub } = setup();
  vi.spyOn(pages, 'fetchPublicPage').mockResolvedValue({
    url: 'https://public.example/pricing',
    title: '协议测试来源',
    text: '修订后的来源原文。',
  });
  vi.spyOn(evidenceAdapter, 'complete').mockResolvedValue({
    content: '未核实的分析，信息未知。',
    toolCalls: [],
  });
  const run = service.trigger(sub.id);
  runtime.start();
  await runtime.idle();
  service.tick();
  expect(store.run(run.id).status).toBe('partial');
  expect(service.find(sub.id).baseline).toEqual({ source_test: 'source_test' });
  expect(store.notifications()[0].title).toContain('检查未完成');
});
it('只引用新快照而没有前期证据时不能推进变化基线', async () => {
  const { store, runtime, service, sub } = setup();
  vi.spyOn(pages, 'fetchPublicPage').mockResolvedValue({
    url: 'https://public.example/pricing',
    title: '协议测试来源',
    text: '更新原文',
  });
  vi.spyOn(evidenceAdapter, 'complete').mockImplementation(async (req) => {
    const tool = req.messages.filter((m) => m.role === 'tool').at(-1);
    if (!tool)
      return {
        content: '',
        toolCalls: [
          { id: 'read', type: 'function', function: { name: 'query_evidence', arguments: '{}' } },
        ],
      };
    const source = JSON.parse(tool.content!).data.sources[0];
    return { content: `仅引用本期 [原文](/evidence/${source.id})`, toolCalls: [] };
  });
  const run = service.trigger(sub.id);
  runtime.start();
  await runtime.idle();
  service.process(store.run(run.id));
  expect(store.run(run.id).status).toBe('partial');
  expect(store.run(run.id).answer).toContain('快照未被引用');
  expect(service.find(sub.id).baseline).toEqual({ source_test: 'source_test' });
});
it('内容回退到旧版本也生成新的观察快照，默认查询返回最新内容', async () => {
  const { store, runtime, service, sub } = setup();
  const original = store.getEvidence('source_test').content;
  const fetch = vi.spyOn(pages, 'fetchPublicPage');
  fetch
    .mockResolvedValueOnce({
      url: 'https://public.example/pricing',
      title: '协议测试来源',
      text: '修订内容',
    })
    .mockResolvedValueOnce({
      url: 'https://public.example/pricing',
      title: '协议测试来源',
      text: original,
    });
  runtime.start();
  const first = service.trigger(sub.id, 'one');
  await runtime.idle();
  service.process(store.run(first.id));
  const second = service.trigger(sub.id, 'two');
  await runtime.idle();
  service.process(store.run(second.id));
  const current = store.latestEvidence()[0];
  expect(current.content).toBe(original);
  expect(current.id).not.toBe('source_test');
  expect(store.evidence()).toHaveLength(3);
  expect(store.notifications()).toHaveLength(2);
});
it('未配置模型、没有来源或选择上传文本时不能创建自动巡检；暂停后不执行', () => {
  const { store, service, sub } = setup();
  expect(() =>
    new Subscriptions(store).create({
      name: 'x',
      prompt: 'x',
      intervalMinutes: 10,
      sourceIds: ['source_test'],
    })
  ).toThrow('配置真实模型');
  expect(() =>
    service.create({ name: 'x', prompt: 'x', intervalMinutes: 10, sourceIds: [] })
  ).toThrow('请选择');
  addSource(store, { id: 'upload_only' });
  expect(() =>
    service.create({ name: 'x', prompt: 'x', intervalMinutes: 10, sourceIds: ['upload_only'] })
  ).toThrow('公开网页');
  service.update(sub.id, { revision: sub.revision, enabled: false });
  expect(() => service.trigger(sub.id)).toThrow('请先启用');
});
