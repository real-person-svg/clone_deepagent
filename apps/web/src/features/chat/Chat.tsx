import { Download, LoaderCircle, MessageCircle, Settings2 } from 'lucide-react';
import { CopyButton } from '../../shared/CopyButton';
import { Markdown } from '../../shared/Markdown';
import { AgentSelector } from '../chat/AgentSelector';
import { Trace } from '../chat/Trace';
import { ChatComposer } from './ChatComposer';
import { useChat } from './useChat';
export function Chat(props: Parameters<typeof useChat>[0]) {
  const { onEvidence, onSettings } = props;
  const chat = useChat(props);
  const {
    showLoading,
    showConversation,
    showWelcome,
    detail,
    mode,
    setMode,
    viewport,
    chatTitle,
    selectorCompact,
    selectorDisabled,
    handleScroll,
    turns,
    suggestions,
  } = chat;

  return (
    <section className="chat-page">
      <header className="page-header">
        {detail && (
          <div className="chat-title">
            <h1>{chatTitle}</h1>
          </div>
        )}
        <AgentSelector
          mode={mode}
          compact={selectorCompact}
          disabled={selectorDisabled}
          onChange={setMode}
        />
        <button
          className="icon-button header-settings"
          aria-label="模型与工作空间设置"
          title="模型与工作空间设置"
          onClick={onSettings}
        >
          <Settings2 size={18} />
        </button>
      </header>
      <div className="chat-viewport" ref={viewport} onScroll={handleScroll}>
        {showLoading && (
          <div className="loading-state">
            <LoaderCircle size={18} className="spin" />
            读取会话历史…
          </div>
        )}
        {showConversation && (
          <div className="conversation-content">
            {turns.map(
              ({
                user,
                run,
                log,
                isActive,
                answer,
                showAnswer,
                showThinking,
                modeLabel,
                providerLabel,
                traceFailed,
                thinkingLabel,
                statusLabel,
                reportUrl,
                canExport,
              }) => (
                <article className="conversation-turn" key={run.id}>
                  <div className="user-message">{user.content}</div>
                  <div className="assistant-identity">
                    <span className="agent-mark small">
                      <MessageCircle size={14} />
                    </span>
                    <strong>研究 Agent</strong>
                    <span>{modeLabel}</span>
                    <span className="identity-provider">{providerLabel}</span>
                  </div>
                  <Trace events={log} active={isActive} failed={traceFailed} />

                  {showAnswer && (
                    <div className="assistant-answer">
                      <Markdown content={answer} onEvidence={onEvidence} />
                    </div>
                  )}
                  {showThinking && (
                    <div className="thinking">
                      <span />
                      <span />
                      <span /> <span className="thinking-text">{thinkingLabel}</span>
                    </div>
                  )}

                  {!isActive && (
                    <div className="answer-footer">
                      <CopyButton text={answer} />
                      <span>{statusLabel}</span>
                      {canExport && (
                        <a href={reportUrl} title="导出 Markdown 报告">
                          <Download size={14} />
                          <span>导出报告</span>
                        </a>
                      )}
                    </div>
                  )}
                </article>
              )
            )}
          </div>
        )}
        {showWelcome && (
          <div className="empty-chat">
            <MessageCircle className="empty-icon" size={24} />
            <h2>有什么可以帮你？</h2>
            <p className="empty-description">查询竞品资料、比较套餐定价，或一起分析商业化策略。</p>
            <div className="prompt-grid">
              {suggestions.map(({ p, handleSelectPrompt }) => (
                <button key={p.tag} onClick={handleSelectPrompt}>
                  {p.tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <ChatComposer chat={chat} />
    </section>
  );
}
