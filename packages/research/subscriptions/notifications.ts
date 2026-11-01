import { createHash } from 'node:crypto';
import type { Run } from '../../contracts/index';
import { now, Store, uid } from '../../storage/index';
import type { SourceCheck } from './refresh';
export function processSubscriptionResult(store: Store, run: Run) {
  if (!run.subscriptionId || !['completed', 'partial', 'failed', 'cancelled'].includes(run.status))
    return;
  store.tx(() => {
    if (store.get('SELECT runId FROM subscription_processing WHERE runId=?', run.id)) return;
    const sub = store.subscriptions().find((s) => s.id === run.subscriptionId);
    if (!sub) return;
    const checks = store.all<SourceCheck>(
      'SELECT sourceId,previousId,currentId,checkedAt FROM source_checks WHERE runId=? ORDER BY sourceId',
      run.id
    );
    const complete =
      run.status === 'completed' && checks.length === sub.sourceIds.length && checks.length > 0;
    if (sub.enabled && complete) {
      const changed = checks.filter(
        (c) => store.getEvidence(c.previousId).hash !== store.getEvidence(c.currentId).hash
      );
      if (changed.length) {
        const fingerprint = createHash('sha256')
          .update(
            JSON.stringify([sub.id, checks.map((c) => [c.sourceId, c.previousId, c.currentId])])
          )
          .digest('hex');
        const text = changed
          .map((c) => {
            const source = store.getEvidence(c.currentId);
            return `${source.competitor} · ${source.title}\n前期 /evidence/${c.previousId}\n本期 /evidence/${c.currentId}`;
          })
          .join('\n\n');
        store.exec(
          'INSERT OR IGNORE INTO notifications VALUES(?,?,?,?,?,?,?,?)',
          uid('notice'),
          sub.id,
          run.id,
          `${sub.name} · ${changed.length} 个来源内容更新`,
          `${text}\n\n原文内容发生变化；商业化含义请结合研究报告及前后证据核对。`,
          fingerprint,
          null,
          now()
        );
      }
      store.exec(
        'UPDATE subscriptions SET baseline=? WHERE id=?',
        JSON.stringify(Object.fromEntries(checks.map((c) => [c.sourceId, c.currentId]))),
        sub.id
      );
    } else if (sub.enabled && run.status !== 'cancelled') {
      store.exec(
        'INSERT OR IGNORE INTO notifications VALUES(?,?,?,?,?,?,?,?)',
        uid('notice'),
        sub.id,
        run.id,
        `${sub.name} · 检查未完成`,
        '本次来源采集或研究未完整完成，已保留旧基线。请查看执行记录后重试。',
        `failure_${run.id}`,
        null,
        now()
      );
    }
    store.exec('INSERT INTO subscription_processing VALUES(?,?)', run.id, now());
  });
}
