import type { ModelMessage, ToolCall } from '../../contracts/index';
export interface Checkpoint {
  messages: ModelMessage[];
  step: number;
  pending: ToolCall[];
  final?: string;
  citationRepairs?: number;
  finalReasoningContent?: string;
}
export const operationKey = (runId: string, taskKey: string, callId: string) =>
  `${runId}:${taskKey}:${callId}`;
