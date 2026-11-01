import { Store } from '../../storage/index';
import { evidenceExcerpt, evidenceTerms } from '../evidence/search';
import { object, string, type Spec } from '../tools/types';
export function createEvidenceTools(store: Store): Record<string, Spec> {
  return {
    list_competitors: {
      description: '列出当前资料中的竞品、来源覆盖与数据性质。',
      schema: object({}),
      execute: (_args, c) => {
        const evidence = store.evidence(c.dataset, c.provider);

        return {
          synthetic: c.provider === 'demo',
          dataset: c.dataset,
          competitors: [...new Set(evidence.map((e) => e.competitor))].map((name) => ({
            name,
            sourceCount: evidence.filter((e) => e.competitor === name).length,
          })),
          note:
            c.provider === 'demo'
              ? 'Alpha/Beta/Gamma 均为虚构测试竞品，不代表真实市场。'
              : '仅使用已导入资料和已采集网页；请补充官方来源。',
        };
      },
    },
    query_evidence: {
      description:
        '检索当前研究资料，返回可引用的证据 ID、匹配处的原文摘录和采集时间。多个关键词以空格分开，按匹配相关度排列；查询可留空。长文可用offset分页阅读全文。',
      schema: object({
        competitor: string,
        query: string,
        offset: { type: 'integer', minimum: 0, maximum: 200000 },
      }),
      execute: (args, c) => {
        const query = String(args.query || ''),
          terms = evidenceTerms(query);
        const found = store
          .evidence(c.dataset, c.provider, String(args.competitor || ''))
          .map((e) => ({
            e,
            score: terms.filter((term) =>
              `${e.title}\n${e.content}`.toLocaleLowerCase().includes(term)
            ).length,
          }))
          .filter(({ score }) => !terms.length || score > 0)
          .sort((a, b) => b.score - a.score)
          .map(({ e }) => e);

        return {
          sources: found.slice(0, 20).map((e) => ({
            id: e.id,
            competitor: e.competitor,
            title: e.title,
            url: e.url,
            observedAt: e.observedAt,
            kind: e.kind,
            text:
              args.offset !== undefined
                ? e.content.slice(Number(args.offset), Number(args.offset) + 3600)
                : evidenceExcerpt(e.content, query),
            totalCharacters: e.content.length,
            nextOffset:
              args.offset !== undefined && Number(args.offset) + 3600 < e.content.length
                ? Number(args.offset) + 3600
                : null,
            metadata: e.metadata,
          })),
          total: found.length,
          missing: found.length ? null : '没有找到可用证据。缺少信息应标为未知，不能推断为不支持。',
        };
      },
    },
  };
}
