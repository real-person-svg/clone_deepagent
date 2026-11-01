import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { Conversation, Notification } from '../../../../../packages/contracts/index';
import { api } from '../../shared/api';

import type { Workspace } from './types';
export function useWorkspaceData() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const refresh = useCallback(() => {
    void Promise.all([
      api<Conversation[]>('/conversations'),
      api<Notification[]>('/notifications'),
      api<Workspace>('/workspace'),
    ])
      .then(([conversation, item, w]) => {
        setConversations(conversation);
        setNotifications(item);
        setWorkspace(w);
        setConnectionError('');
      })
      .catch((e) => setConnectionError(e.message));
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 4000);

    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!searching || !query.trim()) {
      setSearchResults(null);

      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      void api<Conversation[]>(`/conversations?search=${encodeURIComponent(query.trim())}`)
        .then((items) => {
          if (alive) setSearchResults(items);
        })
        .catch(() => {});
    }, 180);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, searching]);

  const filtered = searchResults || conversations;

  const handleToggleSearch = () => setSearching(!searching);

  const handleQueryChange = (e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value);

  return {
    conversations,
    notifications,
    workspace,
    query,
    searching,
    connectionError,
    refresh,
    filtered,
    handleToggleSearch,
    handleQueryChange,
  };
}
