export type Page = 'chat' | 'agents' | 'sources' | 'reports' | 'subscriptions' | 'notifications';

export interface Workspace {
  name: string;

  liveConfigured: boolean;
  model: string | null;
  storage: string;
  scope: string;
  stats: { conversations: number; reports: number; evidence: number };
}
