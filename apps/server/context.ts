import type { FastifyInstance } from 'fastify';
import type { LiveModelConfig } from '../../packages/agent-runtime/model';
import type { Runtime } from '../../packages/agent-runtime/runtime';
import type { Subscriptions } from '../../packages/research/subscriptions';
import type { Store } from '../../packages/storage/index';
export type AppOptions = {
  databasePath?: string;
  live?: LiveModelConfig;
  startWorkers?: boolean;
  logger?: boolean;
};
export interface AppContext {
  app: FastifyInstance;
  store: Store;
  runtime: Runtime;
  subscriptions: Subscriptions;
  options: AppOptions;
}
