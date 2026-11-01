import type { Run } from '../../contracts/index';
import type { Store } from '../../storage/index';
export function publishReport(store: Store, run: Run, result: string) {
  const references = [
    ...new Set([...result.matchAll(/\]\(\/evidence\/([\w-]+)\)/g)].map((m) => m[1])),
  ];
  const eligible = new Set(
    store
      .all<{ evidenceId: string }>('SELECT evidenceId FROM run_evidence WHERE runId=?', run.id)
      .map((e) => e.evidenceId)
  );
  const invalid = references.filter((ref) => !eligible.has(ref));
  if (invalid.length)
    throw new Error(`报告包含 ${invalid.length} 个不属于当前研究快照的引用，已阻止发布`);
  const supported = references.length > 0;
  const failedChildren = store.get<{ n: number }>(
    "SELECT count(*) n FROM tasks WHERE runId=? AND taskKey!='root' AND status='failed'",
    run.id
  )!.n;
  const checks = run.subscriptionId
    ? store.all<{ previousId: string; currentId: string }>(
        'SELECT previousId,currentId FROM source_checks WHERE runId=?',
        run.id
      )
    : [];
  const requiredSources = new Set(checks.flatMap((c) => [c.previousId, c.currentId]));
  const missingSources = [...requiredSources].filter((id) => !references.includes(id)).length;
  let content = result;
  if (missingSources)
    content += `\n\n> 来源覆盖不完整：还有 ${missingSources} 个巡检前后快照未被引用，本次不会更新巡检基线。`;
  if (!supported) content += '\n\n> 证据覆盖不足：本次输出未引用可核对的资料，应作为待验证分析。';
  if (failedChildren)
    content += `\n\n> ${failedChildren} 个子任务未完成，本报告为部分结果，详见执行过程。`;
  store.tx(() => {
    const reportId = store.putReport(run, content, references);
    store.event(run.id, 'report.created', 'root', {
      reportId,
      evidenceCount: references.length,
    });
    store.finish(
      run.id,
      supported && !failedChildren && !missingSources ? 'completed' : 'partial',
      content
    );
  });
}
