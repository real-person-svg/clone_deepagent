import { Agents } from '../agents/Agents';
import { Chat } from '../chat/Chat';
import { Notifications } from '../notifications/Notifications';
import { Reports } from '../reports/Reports';
import { EvidenceDrawer } from '../sources/EvidenceDrawer';
import { Sources } from '../sources/Sources';
import { SubscriptionPanel } from '../subscriptions/SubscriptionPanel';
import { useWorkspace } from './useWorkspace';
import { WorkspaceDialogs } from './WorkspaceDialogs';
import { WorkspaceSidebar } from './WorkspaceSidebar';
export function App() {
  const workspace = useWorkspace();
  const {
    isChatPage,
    isAgentsPage,
    isSourcesPage,
    isReportsPage,
    isSubscriptionsPage,
    isNotificationsPage,
    conversationTitle,
    route,
    notifications,
    connectionError,
    evidenceId,
    setEvidenceId,
    refresh,
    openConversation,
    closeEvidence,
    shellClassName,
    handleOpenSettings,
    liveConfigured,
    sectionLabel,
  } = workspace;

  return (
    <div className={shellClassName}>
      <WorkspaceSidebar workspace={workspace} />
      <main className="main-panel">
        {connectionError && (
          <div className="connection-error" role="alert">
            连接服务失败：{connectionError}
            <button onClick={refresh}>重新连接</button>
          </div>
        )}

        {isChatPage && (
          <Chat
            onSettings={handleOpenSettings}
            conversationId={route.chat}
            conversationTitle={conversationTitle}
            onConversation={openConversation}
            refresh={refresh}
            onEvidence={setEvidenceId}
            liveConfigured={liveConfigured}
          />
        )}
        {!isChatPage && (
          <>
            <header className="section-topbar">
              <span>
                研究空间<span>/</span>
                {sectionLabel}
              </span>
              <span className="subtle-tag">真实来源研究</span>
            </header>

            {isAgentsPage && <Agents onRefresh={refresh} />}
            {isSourcesPage && <Sources onEvidence={setEvidenceId} />}
            {isReportsPage && (
              <Reports onEvidence={setEvidenceId} onConversation={openConversation} />
            )}
            {isSubscriptionsPage && (
              <SubscriptionPanel onConversation={openConversation} refresh={refresh} />
            )}
            {isNotificationsPage && (
              <Notifications
                notifications={notifications}
                refresh={refresh}
                onConversation={openConversation}
              />
            )}
          </>
        )}
      </main>
      <EvidenceDrawer id={evidenceId} onClose={closeEvidence} />
      <WorkspaceDialogs workspace={workspace} />
    </div>
  );
}
