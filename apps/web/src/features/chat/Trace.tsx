import { Check, ChevronDown, ChevronRight, Circle, LoaderCircle } from 'lucide-react';
import { useTrace } from './useTrace';

export function Trace(props: Parameters<typeof useTrace>[0]) {
  const { active, failed, events } = props;
  const { open, summary, rows, className, chevronClassName, handleToggle } = useTrace(props);

  return (
    <div className={className}>
      <button className="trace-summary" aria-expanded={open} onClick={handleToggle}>
        {active && <LoaderCircle size={14} className="spin" />}
        {!active && failed && <Circle size={12} />}
        {!active && !failed && <Check size={14} />}
        <span>任务执行过程</span>
        <span className="trace-meta">{summary}</span>
        <ChevronDown size={14} className={chevronClassName} />
      </button>
      {open && (
        <div className="trace-body">
          {rows.map((row) =>
            row.isTool ? (
              <details className={row.toolClassName} key={row.event.seq}>
                <summary>
                  <ChevronRight size={12} />
                  <span>{row.name}</span>
                  <small>{row.status}</small>
                </summary>
                <div className="tool-detail">
                  <label>参数</label>
                  <pre>{row.argumentsText}</pre>
                  {row.completed && (
                    <>
                      <label>结果</label>
                      <pre>{row.resultText}</pre>
                    </>
                  )}
                </div>
              </details>
            ) : (
              <div className={row.agentClassName} key={row.event.seq}>
                {row.event.type === 'agent.started' && <span className="tiny-agent">✳</span>}
                {row.event.type !== 'agent.started' && <Check size={12} />}
                <span>{row.name}</span>
                <small>{row.status}</small>
              </div>
            )
          )}
          {!events.length && <span className="muted">正在读取执行记录…</span>}
        </div>
      )}
    </div>
  );
}
