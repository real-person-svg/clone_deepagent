import type { Evidence, Run } from '../../contracts/index';
import type { Tools } from '../tools';
import { now, Store } from '../../storage/index';
export interface SourceCheck {
  sourceId: string;
  previousId: string;
  currentId: string;
  checkedAt: string;
}
export async function refreshSubscriptionSources(
  store: Store,
  tools: Tools,
  run: Run,
  signal: AbortSignal
) {
  if (!run.subscriptionId) return [];
  const sub = store.subscriptions().find((s) => s.id === run.subscriptionId);
  if (!sub?.sourceIds.length) throw new Error('订阅缺少真实来源，请重新创建');
  for (const sourceId of sub.sourceIds) {
    if (
      store.get('SELECT sourceId FROM source_checks WHERE runId=? AND sourceId=?', run.id, sourceId)
    )
      continue;
    const source = store.getEvidence(sourceId);
    const current = (await tools.execute(
      'fetch_source',
      { url: source.url, competitor: source.competitor },
      {
        runId: run.id,
        taskKey: 'source_refresh',
        conversationId: run.conversationId,
        provider: 'live',
        signal,
      },
      ['fetch_source']
    )) as Evidence;
    if (signal.aborted) throw signal.reason;
    store.exec(
      'INSERT OR IGNORE INTO source_checks VALUES(?,?,?,?,?)',
      run.id,
      sourceId,
      sub.baseline[sourceId] || sourceId,
      current.id,
      now()
    );
    store.event(run.id, 'source.refreshed', 'root', {
      sourceId,
      previousId: sub.baseline[sourceId] || sourceId,
      currentId: current.id,
    });
  }
  return store.all<SourceCheck>(
    'SELECT sourceId,previousId,currentId,checkedAt FROM source_checks WHERE runId=? ORDER BY sourceId',
    run.id
  );
}
