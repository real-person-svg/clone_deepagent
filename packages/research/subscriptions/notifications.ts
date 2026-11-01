import { createHash } from 'node:crypto';
import type { Run } from '../../contracts/index';
import { now, Store, uid } from '../../storage/index';
import { commercialFacts, compareFacts } from '../pricing';
import { percentChangeText } from '../pricing/change-format';
export function processSubscriptionResult(store: Store, run: Run) {
  if (!run.subscriptionId || !['completed', 'partial', 'failed', 'cancelled'].includes(run.status))
    return;
  store.tx(() => {
    if (store.get('SELECT runId FROM subscription_processing WHERE runId=?', run.id)) return;
    const sub = store.subscriptions().find((s) => s.id === run.subscriptionId);
    if (!sub) return;
    if (sub.enabled && run.status === 'completed') {
      const changes = compareFacts(sub.baseline, run.dataset, sub.threshold);
      if (changes.length) {
        const fingerprint = createHash('sha256')
          .update(
            JSON.stringify([sub.id, sub.baseline, commercialFacts(run.dataset), sub.threshold])
          )
          .digest('hex');
        const text = changes
          .map(
            (c) =>
              `${c.competitor} · ${c.field}：${c.oldValue} → ${c.newValue}${percentChangeText(c.percent)}\n前期 /evidence/${c.oldEvidenceId}\n本期 /evidence/${c.newEvidenceId}`
          )
          .join('\n\n');
        store.exec(
          'INSERT OR IGNORE INTO notifications VALUES(?,?,?,?,?,?,?,?)',
          uid('notice'),
          sub.id,
          run.id,
          `${sub.name} · ${changes.length} 项商业化变化`,
          `${text}\n\n虚构资料验证；可打开研究报告核对来源。`,
          fingerprint,
          null,
          now()
        );
      }
      store.exec(
        'UPDATE subscriptions SET baseline=?,baselineDataset=? WHERE id=?',
        JSON.stringify(commercialFacts(run.dataset)),
        run.dataset,
        sub.id
      );
    } else if (sub.enabled && run.status === 'failed')
      store.exec(
        'INSERT OR IGNORE INTO notifications VALUES(?,?,?,?,?,?,?,?)',
        uid('notice'),
        sub.id,
        run.id,
        `${sub.name} · 检查失败`,
        '本次研究未能完成，已保留旧基线。请查看执行记录后重试。',
        `failure_${run.id}`,
        null,
        now()
      );
    store.exec('INSERT INTO subscription_processing VALUES(?,?)', run.id, now());
  });
}
