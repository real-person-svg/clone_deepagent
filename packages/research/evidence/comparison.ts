import { Store } from '../../storage/index';
import { object, string, type Spec } from '../tools/types';
export function createComparisonTools(store: Store): Record<string, Spec> {
  return {
    compare_snapshots: {
      description:
        '比较同一产品同一来源的两个已保存原文快照，返回前后证据和内容是否变化。内容变化不等同于价格或授权变化，须阅读前后原文核对；价格候选分别使用 normalize_pricing 计算。',
      schema: object({ oldEvidenceId: string, newEvidenceId: string }, [
        'oldEvidenceId',
        'newEvidenceId',
      ]),
      execute: (args, context) => {
        const old = store.getEvidence(String(args.oldEvidenceId));
        const current = store.getEvidence(String(args.newEvidenceId));
        const allowed = new Set(store.researchEvidence(context.runId, true).map((e) => e.id));
        if (!allowed.has(old.id) || !allowed.has(current.id))
          throw new Error('证据不属于本次研究来源');
        if (
          old.competitor !== current.competitor ||
          old.kind !== current.kind ||
          (old.url || old.title) !== (current.url || current.title)
        )
          throw new Error('只能比较同一产品同一来源的快照');
        if (old.observedAt > current.observedAt) throw new Error('前期快照不能晚于本期快照');
        return {
          changed: old.hash !== current.hash,
          oldEvidenceId: old.id,
          newEvidenceId: current.id,
          previous: { observedAt: old.observedAt, text: old.content.slice(0, 6000) },
          current: { observedAt: current.observedAt, text: current.content.slice(0, 6000) },
          note: '观察时间是采集时间；不能据此推断变更生效日期。长文请用 query_evidence 按 evidenceIds 分页核对。',
        };
      },
    },
  };
}
