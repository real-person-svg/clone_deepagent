import type { Dataset, ProviderMode } from '../../contracts/index';
export interface ToolContext {
  runId: string;
  taskKey: string;
  conversationId: string;
  provider: ProviderMode;
  dataset: Dataset;
  signal: AbortSignal;
  delegate?: (tasks: { agent: string; goal: string }[]) => Promise<unknown>;
}

export interface Spec {
  description: string;
  schema: Record<string, unknown>;
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<unknown> | unknown;
}

export const object = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

export const string = { type: 'string', maxLength: 2000 };
