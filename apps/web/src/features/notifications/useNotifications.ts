import type { Notification, Run } from '../../../../../packages/contracts/index';
import { api } from '../../shared/api';
import { localTime } from '../../shared/format';

export function useNotifications({
  notifications,
  refresh,
  onConversation,
}: {
  notifications: Notification[];
  refresh: () => void;
  onConversation: (id: string) => void;
}) {
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  const notificationCards = notifications.map((notification) => {
    const cardClassName = `notification-item ${notification.readAt ? 'read' : ''}`;
    const createdAt = localTime(notification.createdAt, true);

    const handleOpenReport = async () => {
      const value = await api<{ run: Run }>(`/runs/${notification.runId}`);
      await api(`/notifications/${notification.id}/read`, 'PATCH');
      refresh();
      onConversation(value.run.conversationId);
    };

    const handleMarkRead = async () => {
      await api(`/notifications/${notification.id}/read`, 'PATCH');
      refresh();
    };

    return { notification, cardClassName, createdAt, handleOpenReport, handleMarkRead };
  });

  return { unreadCount, notificationCards };
}
