import { now, Store } from '../../storage/index';
import { object, type Spec } from '../tools/types';
import { researchLimits } from './budget';
import { searchPublicWeb } from './web-search';
export function createWebSearchTools(store: Store): Record<string, Spec> {
  return {
    search_web: {
      description:
        '实时网络检索，发现竞品官网、定价、帮助和授权条款。返回的标题/摘要只用于发现来源，不能当作已验证事实或报告引用；必须继续 fetch_source 采集原文后再分析。优先官方来源，检索词应包含产品、地区和关注点。',
      schema: object(
        {
          query: { type: 'string', minLength: 2, maxLength: 300 },
          maxResults: { type: 'integer', minimum: 1, maximum: 10 },
        },
        ['query']
      ),
      execute: async (args, context) => {
        if (!context.runId) throw new Error('网络检索必须在研究任务中执行');
        const run = store.run(context.runId);
        if (run.subscriptionId)
          throw new Error('订阅只检查用户选定的来源；请在交互研究中发现新来源');
        const attempts = store.get<{ n: number }>(
          "SELECT count(*) n FROM tool_calls WHERE runId=? AND name='search_web'",
          context.runId
        )!.n;
        const limit = researchLimits(run.prompt).searches;
        if (attempts > limit)
          throw new Error(
            `已达到本次研究${limit}轮网络检索上限，请根据已采集来源整理结果并说明缺口`
          );
        const query = String(args.query).trim();
        if (query.length < 2) throw new Error('请提供具体的产品与检索主题');
        const results = await searchPublicWeb(query, context.signal, Number(args.maxResults || 5));
        if (context.signal.aborted) throw context.signal.reason;
        const searchedAt = now();
        store.tx(() => {
          for (const result of results)
            store.exec(
              'INSERT INTO search_candidates VALUES(?,?,?,?,?,?) ON CONFLICT(runId,url) DO UPDATE SET title=excluded.title,snippet=excluded.snippet,query=excluded.query,discoveredAt=excluded.discoveredAt',
              context.runId,
              result.url,
              result.title,
              result.snippet,
              query,
              searchedAt
            );
        });
        return {
          engine: 'Bing public RSS',
          query,
          searchedAt,
          results,
          note: results.length
            ? '仅为搜索候选，先采集正文再形成结论；搜索排名不代表来源权威性。'
            : '没有可用搜索结果；可调整检索词。不能据此断言产品不存在或没有该能力。',
        };
      },
    },
  };
}
