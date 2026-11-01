import { createHash } from 'node:crypto';
import type { Evidence } from '../packages/contracts/index';
import type { ModelAdapter } from '../packages/agent-runtime/model';
import { now, Store } from '../packages/storage/index';

// Protocol test doubles live only in the test suite; application startup never imports them.
export function addSource(store: Store, overrides: Partial<Evidence> = {}): Evidence {
  const content = overrides.content || '协议测试原文：每年 USD 120，按席位计费，最低 3 席。';
  const source: Evidence = {
    id: 'source_test',
    competitor: '协议测试产品',
    title: '协议测试来源',
    url: '',
    content,
    kind: 'upload',
    observedAt: now(),
    hash: createHash('sha256').update(content).digest('hex'),
    metadata: {},
    ...overrides,
  };
  store.putEvidence(source);
  return source;
}
export const evidenceAdapter: ModelAdapter = {
  complete: async (request) => {
    const result = request.messages.filter((m) => m.role === 'tool').at(-1);
    const goal = request.messages.filter((m) => m.role === 'user').at(-1)?.content || '';
    const checksMatch = goal.match(/本次实际采集结果：(\[.*?\])。/);
    const evidenceIds = checksMatch
      ? [
          ...new Set(
            (JSON.parse(checksMatch[1]) as { previousId: string; currentId: string }[]).flatMap(
              (c) => [c.previousId, c.currentId]
            )
          ),
        ]
      : undefined;
    if (!result)
      return {
        content: '',
        toolCalls: [
          {
            id: 'lookup',
            type: 'function',
            function: {
              name: 'query_evidence',
              arguments: JSON.stringify(evidenceIds ? { evidenceIds } : {}),
            },
          },
        ],
      };
    const data = JSON.parse(result.content || '{}').data;
    const sources = data?.sources || [];
    const content = sources.length
      ? sources
          .map((s: { id: string; text: string }) => `${s.text} [原文](/evidence/${s.id})`)
          .join('\n\n')
      : '缺少资料，价格与授权未知。';
    request.onText(content);
    return { content, toolCalls: [] };
  },
};
