import type { AgentSpec } from '../../contracts/index';
import type { Store } from '../../storage/index';
export function agentSnapshot(store: Store): Record<string, AgentSpec> {
  return Object.fromEntries(
    store.agents().map((a) => [
      a.id,
      {
        id: a.id,
        name: a.name,
        description: a.description,
        systemPrompt: a.systemPrompt,
        version: a.version,
        tools: a.tools,
        maxSteps: a.maxSteps,
      },
    ])
  );
}
