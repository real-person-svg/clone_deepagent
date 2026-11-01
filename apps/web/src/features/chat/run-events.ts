import type { RunEvent } from '../../../../../packages/contracts/index';

export type RunEvents = Record<string, RunEvent[]>;

export function mergeRunHistory(
  previous: RunEvents,
  logs: readonly (readonly [string, RunEvent[]])[]
): RunEvents {
  const merged = { ...previous };

  for (const [runId, log] of logs) {
    const existing = previous[runId] || [];
    const combined = new Map<number, RunEvent>();
    for (const event of existing) combined.set(event.seq, event);
    for (const event of log) combined.set(event.seq, event);
    merged[runId] = [...combined.values()].sort((a, b) => a.seq - b.seq);
  }

  return merged;
}

export function appendRunEvent(previous: RunEvents, runId: string, event: RunEvent): RunEvents {
  const existing = previous[runId] || [];
  if (existing.some((item) => item.seq === event.seq)) return previous;

  const log = [...existing, event].sort((a, b) => a.seq - b.seq);

  return { ...previous, [runId]: log };
}
