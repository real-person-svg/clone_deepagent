import type { Run } from '../contracts/index';
import { refreshSubscriptionSources } from '../research/subscriptions/refresh';
import { Tools } from '../research/tools';
import { Store, now, uid } from '../storage/index';
import { AgentRunner } from './execution/agent-runner';
import type { Checkpoint } from './execution/checkpoint';
import { assertRunOwner } from './execution/lease';
import { publishReport } from './execution/report';
import { type LiveModelConfig, type ModelAdapter } from './model';
export { operationKey } from './execution/checkpoint';
interface Active {
  owner: string;
  controller: AbortController;
  promise: Promise<void>;
}
export class Runtime {
  private agentRunner: AgentRunner;
  tools: Tools;

  private active = new Map<string, Active>();

  private timer?: ReturnType<typeof setInterval>;

  private stopping = false;

  onComplete?: (run: Run) => void;

  constructor(
    public store: Store,
    private live?: LiveModelConfig,
    private adapters?: Partial<Record<'live', ModelAdapter>>
  ) {
    this.tools = new Tools(store);
    this.agentRunner = new AgentRunner(store, this.tools, live, adapters);
  }

  get liveConfigured() {
    return Boolean(this.live?.baseUrl && this.live?.model) || Boolean(this.adapters?.live);
  }

  start() {
    if (this.timer) return;
    this.stopping = false;
    this.recoverExpired();
    this.timer = setInterval(() => this.pump(), 180);
    this.timer.unref();
    this.pump();
  }

  private recoverExpired() {
    this.store.tx(() => {
      const rows = this.store.all<{ id: string }>(
        "SELECT id FROM runs WHERE status IN ('running','waiting_children') AND (leaseUntil IS NULL OR leaseUntil<?)",
        now()
      );
      for (const r of rows) {
        this.store.exec(
          "UPDATE runs SET status='queued',owner=NULL,leaseUntil=NULL WHERE id=?",
          r.id
        );
        this.store.event(r.id, 'run.recovered', 'root', {
          message: '从最后已提交的 checkpoint 恢复执行',
        });
      }
    });
  }

  pump() {
    if (this.stopping) return;
    this.recoverExpired();
    for (const row of this.store.all<{ id: string }>(
      "SELECT id FROM runs WHERE status='queued' ORDER BY createdAt LIMIT 3"
    )) {
      if (this.active.size >= 2 || this.active.has(row.id)) continue;
      const owner = uid('lease');
      const claimed = this.store.exec(
        "UPDATE runs SET status='running',owner=?,leaseUntil=?,updatedAt=? WHERE id=? AND status='queued'",
        owner,
        new Date(Date.now() + 30000).toISOString(),
        now(),
        row.id
      );
      if (!claimed.changes) continue;
      const controller = new AbortController();
      const promise = Promise.resolve().then(() => this.execute(row.id, owner, controller));
      this.active.set(row.id, { owner, controller, promise });
      void promise.finally(() => this.active.delete(row.id));
    }
  }

  cancel(id: string) {
    const r = this.store.run(id);
    if (['completed', 'partial', 'failed', 'cancelled'].includes(r.status)) return r;
    this.store.tx(() => {
      this.store.exec('UPDATE runs SET cancelRequested=1,updatedAt=? WHERE id=?', now(), id);
      this.store.event(id, 'run.cancel_requested', 'root', {
        message: '正在停止新的模型和工具调用',
      });
      if (r.status === 'queued')
        this.store.finish(id, 'cancelled', '任务已停止。已完成的历史和工具结果已保留。');
    });
    this.active.get(id)?.controller.abort();

    return this.store.run(id);
  }

  private async execute(id: string, owner: string, controller: AbortController) {
    const r = this.store.run(id);
    const heartbeat = setInterval(() => {
      if (this.stopping) return;
      const result = this.store.exec(
        'UPDATE runs SET leaseUntil=? WHERE id=? AND owner=?',
        new Date(Date.now() + 30000).toISOString(),
        id,
        owner
      );
      if (!result.changes || this.store.run(id).cancelRequested) controller.abort();
    }, 5000);
    const deadline = setTimeout(
      () => controller.abort(new Error('任务超过 8 分钟运行上限')),
      8 * 60 * 1000
    );
    const signal = controller.signal;
    try {
      assertRunOwner(this.store, id, owner, signal);
      this.store.tx(() => {
        this.store.exec("UPDATE messages SET status='running' WHERE id=?", `assistant_${id}`);
        this.store.event(id, 'run.started', 'root', {
          message: r.mode === 'multi' ? '构建研究计划与协作任务' : '构建上下文并开始 ReAct',
          version: r.snapshot[r.agentId].version,
          agentId: r.agentId,
        });
      });
      const checks = await refreshSubscriptionSources(this.store, this.tools, r, signal);
      const goal = checks.length
        ? `${r.prompt}\n本次实际采集结果：${JSON.stringify(checks)}。请通过 query_evidence 的 evidenceIds 读取前后原文，使用 compare_snapshots 比较。`
        : r.prompt;
      const result = await this.agentRunner.run(r, 'root', r.agentId, goal, owner, signal);
      assertRunOwner(this.store, id, owner, signal);
      publishReport(this.store, r, result);
      this.onComplete?.(this.store.run(id));
    } catch (error) {
      if (
        !this.stopping &&
        this.store.get<{ owner: string }>('SELECT owner FROM runs WHERE id=?', id)?.owner === owner
      ) {
        const latest = this.store.run(id);
        const cancelled = Boolean(latest.cancelRequested);
        let reason = '执行失败';
        if (cancelled) reason = '任务已停止';
        else if (signal.aborted) reason = '任务超时或执行被中断';
        else if (error instanceof Error) reason = error.message;
        const saved = this.store.checkpoint<Checkpoint>(id, 'root');
        const partial =
          saved?.final ||
          this.store
            .events(id)
            .filter((e) => e.type === 'message.delta' && e.data.taskKey === 'root')
            .map((e) => e.data.text || '')
            .join('');
        this.store.finish(
          id,
          cancelled ? 'cancelled' : 'failed',
          `${partial}${partial ? '\n\n---\n\n' : ''}${reason}。已完成的工具记录保留，可在执行过程中查看。`,
          reason
        );
        this.onComplete?.(this.store.run(id));
      }
    } finally {
      clearInterval(heartbeat);
      clearTimeout(deadline);
    }
  }

  async idle(timeout = 15000) {
    const start = Date.now();
    while (
      this.active.size ||
      this.store.get<{ n: number }>("SELECT count(*) n FROM runs WHERE status='queued'")!.n
    ) {
      if (Date.now() - start > timeout) throw new Error('等待任务完成超时');
      this.pump();
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  async stop() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    const active = [...this.active.entries()];
    active.forEach(([, a]) => a.controller.abort());
    await Promise.all(active.map(([, a]) => a.promise));
    for (const [id, a] of active)
      this.store.exec(
        "UPDATE runs SET status='queued',owner=NULL,leaseUntil=NULL WHERE id=? AND owner=? AND status IN ('running','waiting_children')",
        id,
        a.owner
      );
    this.active.clear();
  }
}
