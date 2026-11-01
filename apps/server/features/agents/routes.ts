import type { AppContext } from '../../context';
import { body, getId, idParams, text } from '../../http/schema';
export function registerAgentsRoutes({ app, store, runtime, subscriptions, options }: AppContext) {
  app.get('/api/agents', () => store.agents());

  app.patch(
    '/api/agents/:id',
    {
      schema: {
        params: idParams,
        body: body({ systemPrompt: text(24000), revision: { type: 'integer', minimum: 1 } }, [
          'systemPrompt',
          'revision',
        ]),
      },
    },
    (request) => {
      const p = request.body as { systemPrompt: string; revision: number };

      return store.saveAgent(getId(request.params), p.systemPrompt, p.revision, false);
    }
  );

  app.post(
    '/api/agents/:id/publish',
    {
      schema: {
        params: idParams,
        body: body({ systemPrompt: text(24000), revision: { type: 'integer', minimum: 1 } }, [
          'systemPrompt',
          'revision',
        ]),
      },
    },
    (request) => {
      const p = request.body as { systemPrompt: string; revision: number };

      return store.saveAgent(getId(request.params), p.systemPrompt, p.revision, true);
    }
  );
}
