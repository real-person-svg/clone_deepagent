import { ArrowRight, ArrowUpRight, Download, FileText } from 'lucide-react';
import { Empty } from '../../shared/Empty';
import { Markdown } from '../../shared/Markdown';
import { useReports } from './useReports';
export function Reports({
  onEvidence,
  onConversation,
}: {
  onEvidence: (id: string) => void;
  onConversation: (id: string) => void;
}) {
  const {
    reports,
    selected,
    reportCards,
    exportUrl,
    selectedTime,
    handleBack,
    handleConversation,
  } = useReports(onConversation);
  if (selected)
    return (
      <section className="report-detail">
        <div className="report-toolbar">
          <button className="text-button" onClick={handleBack}>
            ← 全部报告
          </button>
          <div>
            <button className="text-button" onClick={handleConversation}>
              查看会话
              <ArrowUpRight size={13} />
            </button>
            <a className="button-secondary" href={exportUrl}>
              <Download size={14} />
              导出 Markdown
            </a>
          </div>
        </div>
        <div className="report-document">
          <span className="eyebrow">RESEARCH REPORT · {selectedTime}</span>
          <Markdown content={selected.content} onEvidence={onEvidence} />
        </div>
      </section>
    );

  return (
    <section className="management-page">
      <div className="management-heading">
        <div>
          <span className="eyebrow">RESEARCH ARCHIVE</span>
          <h1>研究报告</h1>
          <p>保存每次研究的结论、证据与观察时间。</p>
        </div>
        <span className="count-label">{reports.length} 份报告</span>
      </div>
      {!reports.length ? (
        <Empty
          icon={FileText}
          title="你的研究，会在这里沉淀"
          description="在对话中完成一次研究，报告和来源快照将自动保存。"
        />
      ) : (
        <div className="report-list">
          {reportCards.map(({ report: r, observedAt, handleSelect }) => (
            <button className="report-list-item" key={r.id} onClick={handleSelect}>
              <span className="document-icon">
                <FileText size={20} />
              </span>
              <div>
                <h2>{r.title}</h2>
                <p>
                  {observedAt} · {r.evidenceIds.length} 个证据引用
                </p>
              </div>
              <ArrowRight size={17} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
