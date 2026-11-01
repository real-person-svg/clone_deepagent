import { ArrowUp, FileText, LoaderCircle, Paperclip, Square, X } from 'lucide-react';
import { AgentSelector } from './AgentSelector';
import { useChat } from './useChat';
export function ChatComposer({ chat }: { chat: ReturnType<typeof useChat> }) {
  const {
    input,
    busy,
    error,
    attachment,
    textarea,
    fileInput,
    active,
    agentId,
    setAgentId,
    selectorDisabled,
    handleDismissError,
    handleRemoveAttachment,
    handleInputChange,
    handleInputKeyDown,
    inputPlaceholder,
    handleChooseFile,
    isRunning,
    handleFileChange,
    composerProviderLabel,
    handleCancelRun,
    sendDisabled,
    handleSend,
  } = chat;

  return (
    <div className="composer-wrap">
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button className="icon-button" aria-label="关闭错误" onClick={handleDismissError}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className="composer">
        {attachment && (
          <div className="attachment-chip">
            <FileText size={13} />
            {attachment.name}
            <button aria-label="移除附件" onClick={handleRemoveAttachment}>
              <X size={12} />
            </button>
          </div>
        )}
        <textarea
          ref={textarea}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          placeholder={inputPlaceholder}
          aria-label="研究问题"
          rows={2}
          maxLength={15000}
        />
        <div className="composer-toolbar">
          <div className="composer-left">
            <button
              className="icon-button"
              title="上传文本资料"
              aria-label="上传文本资料"
              onClick={handleChooseFile}
              disabled={isRunning}
            >
              <Paperclip size={17} />
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".txt,.md,.csv,.json"
              hidden
              onChange={handleFileChange}
            />
            <AgentSelector
              agentId={agentId}
              compact
              disabled={selectorDisabled}
              onChange={setAgentId}
            />
          </div>
          <div className="composer-right">
            <span className="provider-button">
              <span className="provider-dot" />
              {composerProviderLabel}
            </span>

            {active && (
              <button
                className="send-button stop"
                aria-label="停止任务"
                title="停止任务"
                onClick={handleCancelRun}
              >
                <Square size={13} fill="currentColor" />
              </button>
            )}
            {!active && (
              <button
                className="send-button"
                aria-label="发送研究问题"
                title="发送研究问题"
                disabled={sendDisabled}
                onClick={handleSend}
              >
                {busy ? <LoaderCircle size={16} className="spin" /> : <ArrowUp size={18} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
