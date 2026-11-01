import Toast from '@douyinfe/semi-ui/lib/es/toast';
import type { ChangeEvent } from 'react';
import { useCallback, useState } from 'react';
import type { Conversation } from '../../../../../packages/contracts/index';
import { api } from '../../shared/api';

import { useWorkspaceData } from './useWorkspaceData';
import { useWorkspaceRoute } from './useWorkspaceRoute';
import { navigation } from './workspace.config';
export function useWorkspace() {
  const {
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
  } = useWorkspaceData();
  const { route, navigate, openConversation } = useWorkspaceRoute();
  const [collapsed, setCollapsed] = useState(() => window.innerWidth <= 720);
  const [evidenceId, setEvidenceId] = useState<string | null>(null),
    [rename, setRename] = useState<Conversation | null>(null),
    [title, setTitle] = useState(''),
    [deleting, setDeleting] = useState<Conversation | null>(null),
    [settings, setSettings] = useState(false);

  const unread = notifications.filter((item) => !item.readAt).length;
  const closeEvidence = useCallback(() => setEvidenceId(null), []);
  const shellClassName = `app-shell ${collapsed ? 'sidebar-collapsed' : ''}`;
  const collapseLabel = collapsed ? '展开侧栏' : '收起侧栏';
  const sidebarExpanded = !collapsed;

  const handleToggleSidebar = () => setCollapsed(!collapsed);

  const newChatCurrent = route.page === 'chat' && !route.chat ? ('page' as const) : undefined;

  const handleNewChat = () => navigate('chat');

  const navigationItems = navigation.map((item) => {
    const navigationCurrent = route.page === item.id ? ('page' as const) : undefined;

    const handleNavigate = () => navigate(item.id);

    return { item, navigationCurrent, handleNavigate };
  });

  const historyItems = filtered.map((conversation) => {
    const historyClassName = `history-item ${route.chat === conversation.id ? 'selected' : ''}`;

    const handleOpenConversation = () => openConversation(conversation.id);
    const renameLabel = `重命名 ${conversation.title}`;

    const handleRename = () => {
      setRename(conversation);
      setTitle(conversation.title);
    };
    const deleteLabel = `删除 ${conversation.title}`;

    const handleOpenDelete = () => setDeleting(conversation);

    return {
      conversation,
      historyClassName,
      handleOpenConversation,
      renameLabel,
      handleRename,
      deleteLabel,
      handleOpenDelete,
    };
  });

  const historyPlaceholder = query ? '没有找到匹配的研究' : '开始对话后，研究记录会保存在这里';
  const notificationCurrent = route.page === 'notifications' ? ('page' as const) : undefined;

  const handleOpenNotifications = () => navigate('notifications');

  const handleOpenSettings = () => setSettings(true);

  const liveConfigured = workspace?.liveConfigured || false;
  const isChatPage = route.page === 'chat';
  const isAgentsPage = route.page === 'agents';
  const isSourcesPage = route.page === 'sources';
  const isReportsPage = route.page === 'reports';
  const isSubscriptionsPage = route.page === 'subscriptions';
  const isNotificationsPage =
    !isChatPage && !isAgentsPage && !isSourcesPage && !isReportsPage && !isSubscriptionsPage;
  const conversationTitle = conversations.find(
    (conversation) => conversation.id === route.chat
  )?.title;

  const sectionLabel = navigation.find((item) => item.id === route.page)?.label || '研究通知';

  const renameVisible = Boolean(rename);

  const handleCancelRename = () => setRename(null);

  const handleConfirmRename = async () => {
    if (!rename || !title.trim()) return;
    try {
      await api(`/conversations/${rename.id}`, 'PATCH', { title: title.trim() });
      setRename(null);
      refresh();
    } catch (e) {
      Toast.error((e as Error).message);
    }
  };

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value);

  const deleteVisible = Boolean(deleting);

  const handleCancelDelete = () => setDeleting(null);

  const deleteButtonProps = { type: 'danger' as const };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    try {
      await api(`/conversations/${deleting.id}`, 'DELETE');
      if (route.chat === deleting.id) navigate('chat');
      setDeleting(null);
      refresh();
    } catch (e) {
      Toast.error((e as Error).message);
    }
  };

  const handleCloseSettings = () => setSettings(false);

  const conversationCount = workspace?.stats.conversations || 0;
  const reportCount = workspace?.stats.reports || 0;
  const evidenceCount = workspace?.stats.evidence || 0;

  const modelLabel = workspace?.liveConfigured ? workspace.model : '尚未配置模型';

  return {
    isChatPage,
    isAgentsPage,
    isSourcesPage,
    isReportsPage,
    isSubscriptionsPage,
    isNotificationsPage,
    conversationTitle,
    route,
    collapsed,
    conversations,
    notifications,
    query,
    searching,
    connectionError,
    evidenceId,
    setEvidenceId,
    title,
    deleting,
    settings,
    refresh,
    openConversation,
    unread,
    filtered,
    closeEvidence,
    shellClassName,
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
    liveConfigured,
    sectionLabel,
    renameVisible,
    handleCancelRename,
    handleConfirmRename,
    handleTitleChange,
    deleteVisible,
    handleCancelDelete,
    deleteButtonProps,
    handleConfirmDelete,
    handleCloseSettings,
    conversationCount,
    reportCount,
    evidenceCount,
    modelLabel,
  };
}
