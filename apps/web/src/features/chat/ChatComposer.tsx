import {
  ArrowUp,
  Check,
  ChevronDown,
  FileText,
  LoaderCircle,
  MessageCircle,
  Paperclip,
  Square,
  X,
} from 'lucide-react';
import { useChat } from './useChat';
export function ChatComposer({ chat }: { chat: ReturnType<typeof useChat> }) {
  const {
    input,
    provider,
    busy,
    error,
    menu,
    attachment,
    textarea,
    fileInput,
    active,
    handleDismissError,
    handleRemoveAttachment,
    handleInputChange,
    handleInputKeyDown,
    inputPlaceholder,
    handleChooseFile,
    isRunning,
    handleFileChange,
    handleToggleMode,
    composerModeLabel,
    handleToggleProviderMenu,
    composerProviderLabel,
    handleCloseProviderMenu,
    handleSelectDemo,
    liveProviderDisabled,
    handleSelectLive,
    liveProviderDescription,
    handleCancelRun,
    sendDisabled,
    handleSend,
    providerCaption,
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
            <button className="mode-toggle" onClick={handleToggleMode} disabled={isRunning}>
              <MessageCircle className="mode-icon" size={15} />
              {composerModeLabel}
              <ChevronDown size={12} />
            </button>
          </div>
          <div className="composer-right">
            <div className="provider-control">
              <button
                className="provider-button"
                aria-expanded={menu}
                onClick={handleToggleProviderMenu}
                disabled={isRunning}
              >
                <span className="provider-dot" />
                {composerProviderLabel}
                <ChevronDown size={12} />
              </button>
              {menu && (
                <>
                  <button
                    className="menu-catcher"
                    aria-label="关闭模型菜单"
                    onClick={handleCloseProviderMenu}
                  />
                  <div className="provider-menu">
                    <p>选择运行方式</p>
                    <button onClick={handleSelectDemo}>
                      <span>
                        <strong>离线演示</strong>
                        <small>虚构资料，验证工具与执行链路</small>
                      </span>
                      {provider === 'demo' && <Check size={15} />}
                    </button>
                    <button disabled={liveProviderDisabled} onClick={handleSelectLive}>
                      <span>
                        <strong>真实模型</strong>
                        <small>{liveProviderDescription}</small>
                      </span>
                      {provider === 'live' && <Check size={15} />}
                    </button>
                  </div>
                </>
              )}
            </div>

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
      <div className="composer-caption">
        <span>{providerCaption}</span>
        <span>Enter 发送 · Shift + Enter 换行</span>
      </div>
    </div>
  );
}
