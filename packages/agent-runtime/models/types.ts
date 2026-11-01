import type {
  AgentSpec,
  Dataset,
  ModelMessage,
  ModelReply,
  ToolDefinition,
} from '../../contracts/index';
export interface ModelRequest {
  agent: AgentSpec;
  messages: ModelMessage[];
  tools: ToolDefinition[];
  dataset: Dataset;
  signal: AbortSignal;
  onText: (text: string) => void;
}

export interface ModelAdapter {
  complete(request: ModelRequest): Promise<ModelReply>;
}

export interface LiveModelConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs?: number;
}
