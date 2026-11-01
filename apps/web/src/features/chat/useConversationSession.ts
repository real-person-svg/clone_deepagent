import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationDetail, RunEvent } from '../../../../../packages/contracts/index';
import { terminalStatuses } from '../../../../../packages/contracts/index';
import { api } from '../../shared/api';
import { loadRunEvents } from './events-api';
import { mergeRunHistory } from './run-events';

import { useRunEvents } from './useRunEvents';
export interface Attachment {
  name: string;
  content: string;
}
export function useConversationSession(conversationId: string | null, refresh: () => void) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [input, setInput] = useState('');
  const [agentId, setAgentId] = useState('root');
  const [events, setEvents] = useState<Record<string, RunEvent[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const requestId = useRef(0);
  const currentId = useRef(conversationId);
  currentId.current = conversationId;
  const lastRun = detail?.runs.at(-1);
  const active = lastRun && !terminalStatuses.includes(lastRun.status) ? lastRun : null;
  const fetchDetail = useCallback(async (id: string) => {
    const d = await api<ConversationDetail>(`/conversations/${id}`);
    if (currentId.current === id) setDetail(d);

    return d;
  }, []);

  useEffect(() => {
    const req = ++requestId.current;
    setError('');
    setInput('');
    setAttachment(null);
    stick.current = true;
    if (!conversationId) {
      setDetail(null);
      setAgentId('root');
      setLoading(false);

      return;
    }
    setLoading(true);
    api<ConversationDetail>(`/conversations/${conversationId}`)
      .then(async (d) => {
        if (req !== requestId.current) return;
        setDetail(d);
        setAgentId(d.runs.at(-1)?.agentId || 'root');
        const logs = await Promise.all(
          d.runs.map(async (r) => [r.id, await loadRunEvents(r.id)] as const)
        );
        if (req === requestId.current) {
          setEvents((previous) => mergeRunHistory(previous, logs));
        }
      })
      .catch((e) => {
        if (req === requestId.current) setError(e.message);
      })
      .finally(() => {
        if (req === requestId.current) setLoading(false);
      });
  }, [conversationId]);

  useRunEvents(conversationId, lastRun, fetchDetail, refresh, setEvents);

  useEffect(() => {
    if (stick.current && viewport.current)
      viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [events, detail]);

  return {
    detail,
    input,
    setInput,
    agentId,
    setAgentId,
    events,
    setEvents,
    loading,
    error,
    setError,
    attachment,
    setAttachment,
    viewport,
    stick,
    active,
    fetchDetail,
  };
}
