import { afterEach, expect, it, vi } from 'vitest';
import { Runtime } from '../packages/agent-runtime/runtime';
import { initializeAgents } from '../packages/research/agents';
import * as pages from '../packages/research/sources/public-page';
import { parseSearchResults, searchResultUrl } from '../packages/research/sources/web-search';
import { researchLimits } from '../packages/research/sources/budget';
import { Store } from '../packages/storage/index';
const rss =
  '<rss><channel><item><title>官方套餐</title><link>https://official.example/pricing</link><description>搜索摘要，尚未核实</description></item></channel></rss>';
const resources: { store: Store; runtime: Runtime }[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const { store, runtime } of resources.splice(0)) {
    await runtime.stop();
    store.close();
  }
});
it('资料研究员工主动检索、采集、阅读全文并形成引用报告，使用其已发布配置', async () => {
  const store = new Store(':memory:');
  initializeAgents(store);
  const capturedAgents: string[] = [];
  const runtime = new Runtime(store, undefined, {
    live: {
      complete: async (req) => {
        capturedAgents.push(req.agent.id);
        const calls = req.messages.filter((m) => m.role === 'tool');
        const stages = [
          { name: 'search_web', args: { query: '产品官方价格' } },
          {
            name: 'fetch_source',
            args: { url: 'https://official.example/pricing', competitor: '协议测试产品' },
          },
          { name: 'query_evidence', args: { competitor: '协议测试产品' } },
        ];
        if (calls.length < stages.length) {
          const stage = stages[calls.length];
          return {
            content: '',
            toolCalls: [
              {
                id: `step${calls.length}`,
                type: 'function',
                function: { name: stage.name, arguments: JSON.stringify(stage.args) },
              },
            ],
          };
        }
        const source = JSON.parse(calls.at(-1)!.content!).data.sources[0];
        const content = `来源覆盖：官方套餐；授权未知。[原文](/evidence/${source.id})`;
        req.onText(content);
        return { content, toolCalls: [] };
      },
    },
  });
  resources.push({ store, runtime });
  vi.spyOn(pages, 'fetchPublicResource').mockResolvedValue({
    url: 'https://www.bing.com/search',
    type: 'text/xml',
    body: rss,
  });
  vi.spyOn(pages, 'fetchPublicPage').mockResolvedValue({
    url: 'https://official.example/pricing',
    title: '官方套餐',
    text: '真实页面正文在协议测试中替换，不使用搜索摘要作为证据。',
  });
  const selected = store.agents().find((a) => a.id === 'research')!;
  const run = store.createRun({
    prompt: '自行研究公开来源',
    mode: 'single',
    provider: 'live',
    agentId: 'research',
  });
  store.saveAgent('research', '新的未用于本次任务的配置', selected.draftRevision, true);
  runtime.start();
  await runtime.idle();
  expect(new Set(capturedAgents)).toEqual(new Set(['research']));
  expect(store.run(run.id).snapshot.research.version).toBe(selected.version);
  expect(store.run(run.id).status).toBe('completed');
  expect(store.evidence()).toHaveLength(1);
  expect(store.evidence()[0].content).not.toBe('搜索摘要，尚未核实');
  expect(
    store.events(run.id).some((e) => e.type === 'message.delta' && e.agent === 'research')
  ).toBe(true);
  expect(
    store
      .all<{
        name: string;
      }>('SELECT name FROM tool_calls WHERE runId=? ORDER BY createdAt,rowid', run.id)
      .map((r) => r.name)
  ).toEqual(['search_web', 'fetch_source', 'query_evidence']);
  expect(store.reports()[0].evidenceIds).toEqual([store.evidence()[0].id]);
});
it('检索候选仅授权本轮采集，不能跨任务猜测未登记来源', async () => {
  const store = new Store(':memory:');
  initializeAgents(store);
  const runtime = new Runtime(store);
  resources.push({ store, runtime });
  vi.spyOn(pages, 'fetchPublicResource').mockResolvedValue({
    url: 'https://www.bing.com/search',
    type: 'text/xml',
    body: rss,
  });
  const a = store.createRun({ prompt: '搜索', mode: 'single', provider: 'live' });
  const b = store.createRun({ prompt: '其他任务', mode: 'single', provider: 'live' });
  const context = (runId: string) => ({
    runId,
    taskKey: 'root',
    conversationId: store.run(runId).conversationId,
    provider: 'live' as const,
    signal: new AbortController().signal,
  });
  await runtime.tools.execute('search_web', { query: '官方产品' }, context(a.id), ['search_web']);
  expect(store.evidence()).toEqual([]);
  await expect(
    runtime.tools.execute(
      'fetch_source',
      { url: 'https://official.example/pricing', competitor: '产品' },
      context(b.id),
      ['fetch_source']
    )
  ).rejects.toThrow('search_web');
});
it('空结果如实返回，异常页面与不安全 URL 不进入候选', () => {
  expect(parseSearchResults('<rss><channel/></rss>')).toEqual([]);
  expect(() => parseSearchResults('<html>验证页面</html>')).toThrow('无法解析');
  for (const url of [
    'file:///etc/passwd',
    'http://127.0.0.1/',
    'http://[::1]/',
    'https://user:pass@example.org/',
    'http://192.168.1.1/',
    'http://internal.local/',
  ])
    expect(searchResultUrl(url)).toBeNull();
  expect(searchResultUrl('https://example.org/pricing#monthly')).toBe(
    'https://example.org/pricing'
  );
});
it('所选数字员工不存在或没有委派权限时拒绝创建任务', () => {
  const store = new Store(':memory:');
  initializeAgents(store);
  const runtime = new Runtime(store);
  resources.push({ store, runtime });
  expect(() =>
    store.createRun({ prompt: 'x', mode: 'single', provider: 'live', agentId: 'missing' })
  ).toThrow('数字员工不存在');
  expect(() =>
    store.createRun({ prompt: 'x', mode: 'multi', provider: 'live', agentId: 'pricing' })
  ).toThrow('任务委派权限');
  expect(store.conversations()).toHaveLength(0);
});

it('用户明确指定更小的网络检索与页面预算时不能被默认上限放宽', () => {
  expect(researchLimits('最多1轮检索、2个页面采集')).toEqual({ searches: 1, pages: 2 });
  expect(researchLimits('最多两轮检索、三个网页采集')).toEqual({ searches: 2, pages: 3 });
  expect(researchLimits('最多100轮检索、100个页面采集')).toEqual({ searches: 4, pages: 8 });
  expect(researchLimits('至少3个页面，研究4次增长')).toEqual({ searches: 4, pages: 8 });
});
