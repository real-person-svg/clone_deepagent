import { ChevronDown } from 'lucide-react';
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
    dataset,
    sectionLabel,
    handleToggleDataset,
    datasetLabel,
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
            dataset={dataset}
          />
        )}
        {!isChatPage && (
          <>
            <header className="section-topbar">
              <span>
                研究空间<span>/</span>
                {sectionLabel}
              </span>
              <button
                className="dataset-switch"
                title="切换虚构资料快照以验证变化"
                onClick={handleToggleDataset}
              >
                <span className="status-dot on" />
                {datasetLabel}
                <ChevronDown size={12} />
              </button>
            </header>

            {isAgentsPage && <Agents onRefresh={refresh} />}
            {isSourcesPage && <Sources dataset={dataset} onEvidence={setEvidenceId} />}
            {isReportsPage && (
              <Reports onEvidence={setEvidenceId} onConversation={openConversation} />
            )}
            {isSubscriptionsPage && (
              <SubscriptionPanel
                dataset={dataset}
                onConversation={openConversation}
                refresh={refresh}
              />
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
