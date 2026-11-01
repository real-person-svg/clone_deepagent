import { ArrowUpRight, FileText, LoaderCircle, X } from 'lucide-react';
import { useEvidenceDrawer } from './useEvidenceDrawer';
export function EvidenceDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const {
    hasSourceUrl,
    evidence,
    error,
    closeRef,
    handleDrawerClick,
    kindLabel,
    observedAt,
    hashPreview,
  } = useEvidenceDrawer(id, onClose);
  if (!id) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="evidence-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="来源证据"
        onClick={handleDrawerClick}
      >
        <div className="drawer-header">
          <span>
            <FileText size={16} />
            来源证据
          </span>
          <button
            ref={closeRef}
            className="icon-button"
            onClick={onClose}
            aria-label="关闭来源证据"
          >
            <X size={18} />
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}
        {!error && evidence && (
          <div className="drawer-content">
            <span className="eyebrow">
              {evidence.competitor} · {kindLabel}
            </span>
            <h2>{evidence.title}</h2>
            <dl>
              <dt>观察时间</dt>
              <dd>{observedAt}（北京时间）</dd>
              <dt>来源</dt>
              <dd>
                {hasSourceUrl && (
                  <a href={evidence.url} target="_blank" rel="noopener noreferrer">
                    {evidence.url}
                    <ArrowUpRight size={12} />
                  </a>
                )}
                {!hasSourceUrl && '本地导入'}
              </dd>
              <dt>内容摘要</dt>
              <dd className="hash">SHA-256 · {hashPreview}…</dd>
            </dl>
            <div className="source-label">已保存的原文</div>
            <div className="source-text">{evidence.content}</div>
            <p className="caption">
              快照保留当时观察到的内容。来源声明、模型分析与已验证的计算分别核对。
            </p>
          </div>
        )}
        {!error && !evidence && (
          <div className="loading-state">
            <LoaderCircle className="spin" size={18} />
            读取证据…
          </div>
        )}
      </aside>
    </div>
  );
}
