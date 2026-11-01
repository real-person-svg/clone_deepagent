import type { AppContext } from '../../context';
export function registerWorkspaceRoutes({ app, store, runtime, options }: AppContext) {
  app.get('/api/health', () => ({ ok: true, storage: 'SQLite', version: '0.2.0' }));
  app.get('/api/workspace', () => ({
    name: 'Agent Studio',
    liveConfigured: runtime.liveConfigured,
    model: options.live?.model || null,
    storage: 'SQLite',
    scope: '本机工作空间',
    stats: store.stats(),
  }));
}
