import type { Run } from '../../contracts/index';
import type { Store } from '../../storage/index';
export function publishReport(store: Store, run: Run, result: string) {
  const references = [
    ...new Set([...result.matchAll(/\]\(\/evidence\/([\w-]+)\)/g)].map((m) => m[1])),
  ];
  const eligible = new Set(store.evidence(run.dataset, run.provider).map((e) => e.id));
  if (
    run.provider === 'demo' &&
    store.get(
      "SELECT id FROM tool_calls WHERE runId=? AND name='compare_snapshots' AND status='completed'",
      run.id
    )
  ) {
    for (const e of store.evidence(run.dataset === 'updated' ? 'baseline' : 'updated', 'demo'))
      eligible.add(e.id);
  }
  const invalid = references.filter((ref) => !eligible.has(ref));
  if (invalid.length)
    throw new Error(`报告包含 ${invalid.length} 个不属于当前研究快照的引用，已阻止发布`);
  const supported = references.length > 0;
  const failedChildren = store.get<{ n: number }>(
    "SELECT count(*) n FROM tasks WHERE runId=? AND agent!='root' AND status='failed'",
    run.id
  )!.n;
  let content = result;
  if (!supported) content += '\n\n> 证据覆盖不足：本次输出未引用可核对的资料，应作为待验证分析。';
  if (failedChildren)
    content += `\n\n> ${failedChildren} 个子任务未完成，本报告为部分结果，详见执行过程。`;
  store.tx(() => {
    const reportId = store.putReport(run, content, references);
    store.event(run.id, 'report.created', 'root', {
      reportId,
      evidenceCount: references.length,
    });
    store.finish(run.id, supported && !failedChildren ? 'completed' : 'partial', content);
  });
}
