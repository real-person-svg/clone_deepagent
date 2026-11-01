import { createHash } from 'node:crypto';
import type { Evidence } from '../../contracts/index';
import { now, Store, uid } from '../../storage/index';
import { researchLimits } from './budget';
import { fetchPublicPage } from '../sources/public-page';
import { object, type Spec } from '../tools/types';
export function createSourcesTools(store: Store): Record<string, Spec> {
  return {
    fetch_source: {
      description:
        '采集用户提供、已登记或本次 search_web 发现的公共 URL 并保存不可变证据，不支持登录或动态交互页面。',
      schema: object(
        {
          url: { type: 'string', maxLength: 2000, pattern: '^https?://' },
          competitor: { type: 'string', minLength: 1, maxLength: 100 },
        },
        ['url', 'competitor']
      ),
      execute: async (args, c) => {
        if (c.runId) {
          const attempts = store.get<{ n: number }>(
            "SELECT count(*) n FROM tool_calls WHERE runId=? AND name='fetch_source'",
            c.runId
          )!.n;
          const run = store.run(c.runId);
          const limit = researchLimits(run.prompt).pages;
          if (attempts > limit)
            throw new Error(`已达到本次研究${limit}个页面采集上限，请整理现有证据并说明缺口`);
          const userUrls = [...run.prompt.matchAll(/https?:\/\/[^\s<>"）)]+/g)].map((m) =>
            m[0].replace(/[，。；、]+$/, '')
          );
          const subscription = run.subscriptionId
            ? store.subscriptions().find((s) => s.id === run.subscriptionId)
            : undefined;
          const knownUrls = (
            subscription
              ? subscription.sourceIds.map((id) => store.getEvidence(id))
              : store.evidence()
          )
            .flatMap((e) => [
              e.url,
              ...(!subscription && Array.isArray(e.metadata.links)
                ? (e.metadata.links as { url: string }[]).map((link) => link.url)
                : []),
            ])
            .filter(Boolean);
          if (subscription) userUrls.length = 0;
          const discoveredUrls = subscription
            ? []
            : store
                .all<{ url: string }>('SELECT url FROM search_candidates WHERE runId=?', c.runId)
                .map((row) => row.url);

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
            ![...userUrls, ...knownUrls, ...discoveredUrls].some(
              (url) => normalize(url) === normalize(String(args.url))
            )
          )
            throw new Error('请先通过 search_web 检索来源，或提供/登记官方 URL，再采集正文');
        }
        const page = await fetchPublicPage(String(args.url), c.signal);
        if (c.runId)
          store.tx(() => {
            for (const link of page.links || [])
              store.exec(
                'INSERT OR IGNORE INTO search_candidates VALUES(?,?,?,?,?,?)',
                c.runId,
                link.url,
                link.title,
                '已采集页面中的真实链接',
                `linked_from:${page.url}`,
                now()
              );
          });
        const hash = createHash('sha256').update(page.text).digest('hex');
        const existing = store.get<{ id: string; hash: string }>(
          "SELECT id,hash FROM evidence WHERE url=? AND competitor=? AND kind='web' ORDER BY observedAt DESC,rowid DESC LIMIT 1",
          page.url,
          String(args.competitor)
        );
        if (existing?.hash === hash) {
          const e = store.getEvidence(existing.id);

          return {
            ...e,
            checkedAt: now(),
            links: page.links || [],
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
          observedAt: now(),
          hash,
          metadata: { capture: 'static', verification: 'source_text', links: page.links || [] },
        };
        store.putEvidence(e);

        return {
          ...e,
          checkedAt: now(),
          links: page.links || [],
          content: e.content.slice(0, 12000),
          totalCharacters: e.content.length,
          truncated: e.content.length > 12000,
        };
      },
    },
  };
}
