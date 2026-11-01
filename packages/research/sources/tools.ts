import { createHash } from 'node:crypto';
import type { Evidence } from '../../contracts/index';
import { now, Store, uid } from '../../storage/index';
import { fetchPublicPage } from '../sources/public-page';
import { object, type Spec } from '../tools/types';
export function createSourcesTools(store: Store): Record<string, Spec> {
  return {
    fetch_source: {
      description:
        '采集用户明确提供或已登记的公共 URL 并保存不可变证据，不支持登录或动态交互页面。',
      schema: object(
        {
          url: { type: 'string', maxLength: 2000, pattern: '^https?://' },
          competitor: { type: 'string', minLength: 1, maxLength: 100 },
        },
        ['url', 'competitor']
      ),
      execute: async (args, c) => {
        if (c.runId) {
          const run = store.run(c.runId);
          const userUrls = [...run.prompt.matchAll(/https?:\/\/[^\s<>"）)]+/g)].map((m) =>
            m[0].replace(/[，。；、]+$/, '')
          );
          const knownUrls = store
            .evidence(c.dataset, 'live')
            .map((e) => e.url)
            .filter(Boolean);

          const normalize = (input: string) => {
            try {
              const url = new URL(input);
              url.hash = '';

              return url.href;
            } catch {
              return '';
            }
          };
          if (
            ![...userUrls, ...knownUrls].some(
              (url) => normalize(url) === normalize(String(args.url))
            )
          )
            throw new Error('只允许采集用户明确提供或在来源资料中登记的 URL；请先补充来源');
        }
        const page = await fetchPublicPage(String(args.url), c.signal);
        const hash = createHash('sha256').update(page.text).digest('hex');
        const existing = store.get<{ id: string }>(
          'SELECT id FROM evidence WHERE url=? AND hash=? AND competitor=?',
          page.url,
          hash,
          String(args.competitor)
        );
        if (existing) {
          const e = store.getEvidence(existing.id);

          return {
            ...e,
            content: e.content.slice(0, 12000),
            totalCharacters: e.content.length,
            truncated: e.content.length > 12000,
          };
        }
        const e: Evidence = {
          id: uid('source'),
          competitor: String(args.competitor),
          title: page.title,
          url: page.url,
          content: page.text,
          kind: 'web',
          dataset: 'all',
          observedAt: now(),
          hash,
          metadata: { capture: 'static', verification: 'source_text' },
        };
        store.putEvidence(e);

        return {
          ...e,
          content: e.content.slice(0, 12000),
          totalCharacters: e.content.length,
          truncated: e.content.length > 12000,
        };
      },
    },
  };
}
