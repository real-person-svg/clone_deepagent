import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Runtime } from '../../packages/agent-runtime/runtime';
import { seed } from '../../packages/research/fixtures';
import { Subscriptions } from '../../packages/research/subscriptions';
import { Store } from '../../packages/storage/index';
import type { AppContext, AppOptions } from './context';
import { registerAgentsRoutes } from './features/agents/routes';
import { registerConversationsRoutes } from './features/conversations/routes';
import { registerNotificationsRoutes } from './features/notifications/routes';
import { registerReportsRoutes } from './features/reports/routes';
import { registerRunsRoutes } from './features/runs/routes';
import { registerSourcesRoutes } from './features/sources/routes';
import { registerSubscriptionsRoutes } from './features/subscriptions/routes';
import { registerWorkspaceRoutes } from './features/workspace/routes';
import { registerHttpBoundary } from './http/boundary';
export async function createApp(options: AppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 2 * 1024 * 1024 });
  const store = new Store(options.databasePath || './data/workspace.sqlite');

  seed(store);

  const runtime = new Runtime(store, options.live);
  const subscriptions = new Subscriptions(store);

  runtime.onComplete = (r) => subscriptions.process(r);
  const context: AppContext = { app, store, runtime, subscriptions, options };

  registerHttpBoundary(app);

  registerWorkspaceRoutes(context);
  registerConversationsRoutes(context);
  registerRunsRoutes(context);
  registerSourcesRoutes(context);
  registerReportsRoutes(context);
  registerAgentsRoutes(context);
  registerSubscriptionsRoutes(context);
  registerNotificationsRoutes(context);

  const webRoot = resolve('dist/web');

  if (existsSync(webRoot)) {
    await app.register(fastifyStatic, { root: webRoot });
    app.setNotFoundHandler((request, reply) =>
      request.url.startsWith('/api/')
        ? reply.code(404).send({ error: '接口不存在' })
        : reply.sendFile('index.html')
    );
  }

  app.addHook('onClose', async () => {
    subscriptions.stop();
    await runtime.stop();
    store.close();
  });

  if (options.startWorkers !== false) {
    runtime.start();
    subscriptions.start();
  }

  return { app, store, runtime, subscriptions };
}
