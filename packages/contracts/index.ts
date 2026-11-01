export type AgentMode = 'single' | 'multi';
export type ProviderMode = 'demo' | 'live';
export type Dataset = 'baseline' | 'updated';
export type RunStatus =
  | 'queued'
  | 'running'
  | 'waiting_children'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled';
export const terminalStatuses: RunStatus[] = ['completed', 'partial', 'failed', 'cancelled'];

export interface Conversation {
  id: string;
  title: string;
  mode: AgentMode;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  activeRunId?: string | null;
  preview?: string;
}
export interface Message {
  id: string;
  conversationId: string;
  runId: string;
  role: 'user' | 'assistant';
  content: string;
  status: string;
  createdAt: string;
}
export interface Run {
  id: string;
  conversationId: string;
  prompt: string;
  mode: AgentMode;
  provider: ProviderMode;
  dataset: Dataset;
  status: RunStatus;
  answer: string;
  error: string | null;
  cancelRequested: number;
  snapshot: Record<string, AgentSpec>;
  subscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}
export interface RunEvent {
  runId: string;
  seq: number;
  type: string;
  agent: string;
  data: Record<string, unknown>;
  createdAt: string;
}
export interface AgentSpec {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  version: number;
  tools: string[];
  maxSteps: number;
}
export interface AgentSummary extends AgentSpec {
  draft: AgentSpec;
  draftRevision: number;
  updatedAt: string;
}
export interface Evidence {
  id: string;
  competitor: string;
  title: string;
  url: string;
  content: string;
  kind: 'fixture' | 'upload' | 'web';
  dataset: Dataset | 'all';
  observedAt: string;
  hash: string;
  metadata: Record<string, unknown>;
}
export interface PricePlan {
  competitor: string;
  plan: string;
  amount: string;
  currency: string;
  billingPeriod: 'month' | 'year';
  unit: 'seat' | 'team';
  minimumSeats: number;
  quota: string;
  commercialRights: string;
  api: string;
  evidenceId: string;
  sourceQuote?: string;
}
export interface NormalizedPrice extends PricePlan {
  monthlyEquivalent: string;
  annualTotal: string;
  teamSize: number;
  teamMonthly: string;
  conditions: string;
}
export interface Report {
  id: string;
  runId: string;
  conversationId: string;
  title: string;
  content: string;
  evidenceIds: string[];
  dataset: Dataset;
  createdAt: string;
}
export interface Subscription {
  id: string;
  name: string;
  prompt: string;
  enabled: number;
  intervalMinutes: number;
  threshold: number;
  baseline: Record<string, string>;
  baselineDataset: Dataset;
  nextFireAt: string;
  lastRunAt: string | null;
  lastRunId: string | null;
  createdAt: string;
  revision: number;
  templateId?: string;
  templateVersion?: number;
  agentSnapshot?: string;
}
export interface TaskTemplate {
  id: string;
  name: string;
  prompt: string;
  draftPrompt: string;
  draftRevision: number;
  publishedVersion: number;
  updatedAt: string;
}
export interface Notification {
  id: string;
  subscriptionId: string;
  runId: string;
  title: string;
  content: string;
  fingerprint: string;
  readAt: string | null;
  createdAt: string;
}
export interface ConversationDetail extends Conversation {
  messages: Message[];
  runs: Run[];
  reports: Report[];
}
export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  // Opaque provider continuation field. Persist for replay; never emit to chat/events.
  reasoning_content?: string;
}
export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}
export interface ToolDefinition {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}
export interface ModelReply {
  content: string;
  toolCalls: ToolCall[];
  usage?: { input: number; output: number };
  reasoningContent?: string;
}
