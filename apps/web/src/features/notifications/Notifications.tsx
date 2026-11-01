import { ArrowUpRight, Bell, Check } from 'lucide-react';
import { Empty } from '../../shared/Empty';
import { useNotifications } from './useNotifications';
export function Notifications(props: Parameters<typeof useNotifications>[0]) {
  const { notifications } = props;
  const { unreadCount, notificationCards } = useNotifications(props);

  return (
    <section className="management-page">
      <div className="management-heading">
        <div>
          <span className="eyebrow">SIGNALS, NOT NOISE</span>
          <h1>研究通知</h1>
          <p>值得关注的变化，以及需要处理的研究任务。</p>
        </div>
        <span className="count-label">{unreadCount} 条未读</span>
      </div>
      {!notifications.length ? (
        <Empty
          icon={Bell}
          title="暂时没有需要关注的变化"
          description="启用订阅后，已核对的价格与授权变化会显示在这里。"
        />
      ) : (
        <div className="notification-list">
          {notificationCards.map(
            ({ notification, cardClassName, createdAt, handleOpenReport, handleMarkRead }) => (
              <article className={cardClassName} key={notification.id}>
                <span className="notification-symbol">
                  <Bell size={18} />
                </span>
                <div>
                  <div className="notification-title">
                    <h2>{notification.title}</h2>
                    {!notification.readAt && <span className="unread-dot" />}
                  </div>
                  <p className="notification-body">{notification.content}</p>
                  <div className="notification-footer">
                    <span>{createdAt}</span>
                    <button className="text-button" onClick={handleOpenReport}>
                      查看研究报告
                      <ArrowUpRight size={13} />
                    </button>
                    {!notification.readAt && (
                      <button className="text-button" onClick={handleMarkRead}>
                        <Check size={13} />
                        标为已读
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          )}
        </div>
      )}
    </section>
  );
}
