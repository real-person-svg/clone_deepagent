import {
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from './useWorkspace';
export function WorkspaceSidebar({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const {
    collapsed,
    query,
    searching,
    unread,
    filtered,
    collapseLabel,
    sidebarExpanded,
    handleToggleSidebar,
    newChatCurrent,
    handleNewChat,
    navigationItems,
    handleToggleSearch,
    handleQueryChange,
    historyItems,
    historyPlaceholder,
    notificationCurrent,
    handleOpenNotifications,
    handleOpenSettings,
  } = workspace;

  return (
    <aside className="sidebar">
      <div className="brand">
        {!collapsed && <strong>Agent 研究助手</strong>}
        <button
          className="icon-button collapse-button"
          aria-label={collapseLabel}
          aria-expanded={sidebarExpanded}
          aria-controls="agent-sidebar-navigation"
          onClick={handleToggleSidebar}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>
      {!collapsed && <div className="navigation-heading">个人</div>}
      <button
        className="new-chat"
        title="新建任务"
        aria-label="新建任务"
        aria-current={newChatCurrent}
        onClick={handleNewChat}
      >
        <Plus size={17} />
        {!collapsed && <span>新建任务</span>}
      </button>
      <nav id="agent-sidebar-navigation" className="main-navigation" aria-label="工作台导航">
        {navigationItems.map(({ item, navigationCurrent, handleNavigate }) => (
          <button
            key={item.id}
            className="navigation-item"
            aria-current={navigationCurrent}
            title={item.label}
            onClick={handleNavigate}
          >
            <item.icon size={17} strokeWidth={1.7} />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
      {!collapsed && (
        <div className="history-section">
          <div className="history-heading">
            <span>历史记录</span>
            <button
              className="icon-button"
              title="搜索历史"
              aria-label="搜索历史"
              onClick={handleToggleSearch}
            >
              <Search size={14} />
            </button>
          </div>
          {searching && (
            <div className="history-search">
              <Search size={13} />
              <input
                aria-label="搜索历史研究"
                value={query}
                onChange={handleQueryChange}
                placeholder="搜索研究内容…"
                autoFocus
              />
            </div>
          )}
          <div className="history-list">
            {filtered.length ? (
              historyItems.map(
                ({
                  conversation,
                  historyClassName,
                  handleOpenConversation,
                  renameLabel,
                  handleRename,
                  deleteLabel,
                  handleOpenDelete,
                }) => (
                  <div key={conversation.id} className={historyClassName}>
                    <button
                      className="history-link"
                      onClick={handleOpenConversation}
                      title={conversation.title}
                    >
                      {conversation.activeRunId && <span className="live-dot" />}
                      <span>{conversation.title}</span>
                    </button>
                    <div className="history-actions">
                      <button
                        className="icon-button"
                        aria-label={renameLabel}
                        onClick={handleRename}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={deleteLabel}
                        onClick={handleOpenDelete}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )
              )
            ) : (
              <p className="history-placeholder">{historyPlaceholder}</p>
            )}
          </div>
        </div>
      )}
      <div className="sidebar-footer">
        <button
          className="notification-nav"
          title="研究通知"
          aria-label="研究通知"
          aria-current={notificationCurrent}
          onClick={handleOpenNotifications}
        >
          <Bell size={17} />
          {!collapsed && <span>研究通知</span>}
          {unread > 0 && <span className="notification-count">{unread}</span>}
        </button>
        <button
          className="workspace-button"
          title="本地工作空间设置"
          aria-label="本地工作空间设置"
          onClick={handleOpenSettings}
        >
          <span className="workspace-avatar">A</span>
          {!collapsed && (
            <>
              <span>
                <strong>本地工作空间</strong>
                <small>
                  <i />
                  SQLite 持久化
                </small>
              </span>
              <Settings2 size={15} />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
