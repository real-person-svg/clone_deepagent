import { createHash } from 'node:crypto';
import { now, uid } from '../../../../packages/storage/index';
import type { AppContext } from '../../context';
import { body, getId, idParams, text } from '../../http/schema';
export function registerSourcesRoutes({ app, store, runtime, subscriptions, options }: AppContext) {
  app.get('/api/evidence', (request) => {
    const q = request.query as {
      competitor?: string;
      query?: string;
      kind?: string;
    };

    return store.evidence(q.competitor, q.query).filter((e) => !q.kind || e.kind === q.kind);
  });

  app.get('/api/evidence/:id', { schema: { params: idParams } }, (request) =>
    store.getEvidence(getId(request.params))
  );

  app.post(
    '/api/documents',
    {
      schema: {
        body: body(
          { title: text(200), competitor: text(100), content: text(200000), filename: text(200) },
          ['title', 'competitor', 'content']
        ),
      },
    },
    (request) => {
      const p = request.body as {
        title: string;
        competitor: string;
        content: string;
        filename?: string;
      };
      const e = {
        id: uid('doc'),
        title: p.title,
        competitor: p.competitor,
        content: p.content,
        url: '',
        kind: 'upload' as const,
        observedAt: now(),
        hash: createHash('sha256').update(p.content).digest('hex'),
        metadata: {
          filename: p.filename || p.title,
          source: '用户提供',
          verification: 'unverified',
        },
      };
      store.putEvidence(e);

      return e;
    }
  );

  app.post(
    '/api/sources',
    { schema: { body: body({ url: text(2000), competitor: text(100) }, ['url', 'competitor']) } },
    async (request) => {
      const p = request.body as { url: string; competitor: string };
      const data = await runtime.tools.execute(
        'fetch_source',
        p,
        {
          runId: '',
          taskKey: '',
          conversationId: '',
          provider: 'live',

          signal: AbortSignal.timeout(20000),
        },
        ['fetch_source']
      );

      return data;
    }
  );
}
