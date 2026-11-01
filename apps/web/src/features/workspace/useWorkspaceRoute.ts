import { useEffect, useState } from 'react';
import type { Page } from './types';
const fromLocation = () => ({
  page: (new URLSearchParams(location.search).get('page') || 'chat') as Page,
  chat: new URLSearchParams(location.search).get('chat'),
});
export function useWorkspaceRoute() {
  const [route, setRoute] = useState(fromLocation);

  useEffect(() => {
    const pop = () => setRoute(fromLocation());
    window.addEventListener('popstate', pop);

    return () => window.removeEventListener('popstate', pop);
  }, []);

  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setRoute({ page: 'chat', chat: null });
        history.pushState(null, '', location.pathname);
      }
    };
    window.addEventListener('keydown', shortcut);

    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  const navigate = (page: Page, chat: string | null = null) => {
    setRoute({ page, chat });
    const params = new URLSearchParams();
    if (page !== 'chat') params.set('page', page);
    if (chat) params.set('chat', chat);
    history.pushState(null, '', `${location.pathname}${params.size ? '?' + params : ''}`);
  };

  const openConversation = (id: string) => navigate('chat', id);

  return { route, navigate, openConversation };
}
