import type { Store } from '../../storage/index';
export function assertRunOwner(store: Store, id: string, owner: string, signal: AbortSignal) {
  if (signal.aborted) throw new Error('任务已停止');
  const row = store.get<{ owner: string; cancelRequested: number }>(
    'SELECT owner,cancelRequested FROM runs WHERE id=?',
    id
  );
  if (!row || row.owner !== owner) throw new Error('执行租约已失效');
  if (row.cancelRequested) throw new Error('任务已停止');
}
