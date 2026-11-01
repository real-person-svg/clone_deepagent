import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Run, RunEvent } from '../../../../../packages/contracts/index';
import { terminalStatuses } from '../../../../../packages/contracts/index';
import { loadRunEvents } from './events-api';
import { appendRunEvent } from './run-events';

export function useRunEvents(
  conversationId: string | null,
  lastRun: Run | undefined,
  fetchDetail: (id: string) => Promise<unknown>,
  refresh: () => void,
  setEvents: Dispatch<SetStateAction<Record<string, RunEvent[]>>>
) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!conversationId || !lastRun) return;
    const runId = lastRun.id,
      chatId = conversationId;
    let closed = false,
      retry: ReturnType<typeof setTimeout> | undefined,
      source: EventSource;
    let cursor = 0;

    const connect = () => {
      if (closed) return;
      source = new EventSource(`/api/runs/${runId}/events?afterSeq=${cursor}`);
      source.addEventListener('snapshot', (event) => {
        const run = JSON.parse((event as MessageEvent).data) as Run;
        if (terminalStatuses.includes(run.status)) {
          source.close();
          closed = true;
          void fetchDetail(chatId);
          void loadRunEvents(runId)
            .then((log) => setEvents((previous) => ({ ...previous, [runId]: log })))
            .catch(() => {});
        }
      });
      source.addEventListener('run-event', (event) => {
        const e = JSON.parse((event as MessageEvent).data) as RunEvent;
        cursor = Math.max(cursor, e.seq);
        setEvents((previous) => appendRunEvent(previous, runId, e));
        if (/^run\.(completed|partial|failed|cancelled)$/.test(e.type)) {
          source.close();
          closed = true;
          void fetchDetail(chatId);
          refreshRef.current();
        }
      });
      source.onerror = () => {
        source.close();
        if (!closed) retry = setTimeout(connect, 1000);
      };
    };
    if (!terminalStatuses.includes(lastRun.status)) connect();

    return () => {
      closed = true;
      source?.close();
      if (retry) clearTimeout(retry);
    };
  }, [conversationId, lastRun?.id, fetchDetail]);
}
