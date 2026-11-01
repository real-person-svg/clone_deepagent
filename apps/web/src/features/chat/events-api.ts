import { api } from '../../shared/api';

export async function loadRunEvents(id: string) {
  const events: import('../../../../../packages/contracts/index').RunEvent[] = [];
  let cursor = 0;
  for (;;) {
    const page = await api<import('../../../../../packages/contracts/index').RunEvent[]>(
      `/runs/${id}/event-log?afterSeq=${cursor}`
    );
    events.push(...page);
    if (page.length < 500) return events;
    cursor = page.at(-1)!.seq;
  }
}
