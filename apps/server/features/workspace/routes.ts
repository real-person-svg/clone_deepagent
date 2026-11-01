import type { Dataset } from '../../../../packages/contracts/index';
import type { AppContext } from '../../context';
import { body } from '../../http/schema';
export function registerWorkspaceRoutes({
  app,
  store,
  runtime,
  subscriptions,
  options,
}: AppContext) {
  app.get('/api/health', () => ({ ok: true, storage: 'SQLite', version: '0.1.0' }));

  app.get('/api/workspace', () => ({
    name: 'Agent Studio',
    dataset: store.setting('dataset', 'baseline'),
    liveConfigured: runtime.liveConfigured,
    model: options.live?.model || null,
    storage: 'SQLite',
    scope: '本机工作空间',
    stats: store.stats(),
  }));

  app.patch(
    '/api/workspace',
    { schema: { body: body({ dataset: { enum: ['baseline', 'updated'] } }, ['dataset']) } },
    (request) => {
      const { dataset } = request.body as { dataset: Dataset };
      store.setSetting('dataset', dataset);

      return { dataset };
    }
  );
}
