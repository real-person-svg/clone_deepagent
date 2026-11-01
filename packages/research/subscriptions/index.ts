import type { Dataset, Run, Subscription } from '../../contracts/index';
import { AppError, now, parse, Store, uid } from '../../storage/index';
import { commercialFacts } from '../pricing';
import { agentSnapshot } from './agent-snapshot';
import { processSubscriptionResult } from './notifications';
import { migrateSubscriptions } from './schema';
import { TaskTemplates } from './templates';
export class Subscriptions {
  private taskTemplates: TaskTemplates;
  constructor(private store: Store) {
    migrateSubscriptions(store);
    this.taskTemplates = new TaskTemplates(store);
  }
  templates() {
    return this.taskTemplates.list();
  }
  saveTemplate(input: Parameters<TaskTemplates['save']>[0]) {
    return this.taskTemplates.save(input);
  }
  process(run: Run) {
    return processSubscriptionResult(this.store, run);
  }
  private timer?: ReturnType<typeof setInterval>;

  create(input: {
    name: string;
    prompt: string;
    intervalMinutes: number;
    threshold: number;
    templateId?: string;
  }) {
    const id = uid('sub'),
      time = now();
    const dataset = this.store.setting('dataset', 'baseline') as Dataset;
    const template = this.templates().find((t) => t.id === (input.templateId || 'tpl_commercial'));
    if (!template?.publishedVersion) throw new AppError(400, '请先发布任务模板再创建订阅');
    const version = this.store.get<{ agentSnapshot: string }>(
      'SELECT agentSnapshot FROM task_template_versions WHERE templateId=? AND version=?',
      template.id,
      template.publishedVersion
    )!;
    this.store.exec(
      'INSERT INTO subscriptions(id,name,prompt,intervalMinutes,threshold,baseline,baselineDataset,nextFireAt,createdAt,templateId,templateVersion,agentSnapshot) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
      id,
      input.name,
      input.prompt,
      input.intervalMinutes,
      input.threshold,
      JSON.stringify(commercialFacts(dataset)),
      dataset,
      new Date(Date.now() + input.intervalMinutes * 60000).toISOString(),
      time,
      template.id,
      template.publishedVersion,
      version.agentSnapshot
    );

    return this.store.subscriptions().find((s) => s.id === id)!;
  }

  update(
    id: string,
    patch: {
      enabled?: boolean;
      name?: string;
      threshold?: number;
      intervalMinutes?: number;
      revision: number;
    }
  ) {
    const current = this.find(id);
    if (patch.revision !== current.revision)
      throw new AppError(409, '订阅已更新，请刷新后重试', 'REVISION_CONFLICT');
    const result = this.store.exec(
      'UPDATE subscriptions SET enabled=?,name=?,threshold=?,intervalMinutes=?,nextFireAt=?,revision=revision+1 WHERE id=? AND revision=?',
      patch.enabled === undefined ? current.enabled : Number(patch.enabled),
      patch.name ?? current.name,
      patch.threshold ?? current.threshold,
      patch.intervalMinutes ?? current.intervalMinutes,
      patch.intervalMinutes !== undefined || patch.enabled === true
        ? new Date(
            Date.now() + (patch.intervalMinutes ?? current.intervalMinutes) * 60000
          ).toISOString()
        : current.nextFireAt,
      id,
      patch.revision
    );
    if (!result.changes) throw new AppError(409, '订阅已更新，请刷新后重试', 'REVISION_CONFLICT');

    return this.find(id);
  }

  find(id: string): Subscription {
    const s = this.store.subscriptions().find((s) => s.id === id);
    if (!s) throw new AppError(404, '订阅不存在');

    return s;
  }

  trigger(id: string, key = now()) {
    return this.store.tx(() => {
      const sub = this.find(id);
      if (!sub.enabled) throw new AppError(409, '请先启用订阅');
      const same = this.store.get<{ runId: string }>(
        'SELECT runId FROM scheduled_fires WHERE subscriptionId=? AND scheduledFor=?',
        id,
        key
      );
      if (same) return this.store.run(same.runId);
      const active = this.store.get<{ id: string }>(
        "SELECT id FROM runs WHERE subscriptionId=? AND status IN ('queued','running','waiting_children')",
        id
      );
      if (active) return this.store.run(active.id);
      const dataset = this.store.setting('dataset', 'baseline') as Dataset;
      const template = this.store.get<{ prompt: string }>(
        'SELECT prompt FROM task_template_versions WHERE templateId=? AND version=?',
        sub.templateId || 'tpl_commercial',
        sub.templateVersion || 1
      );
      const run = this.store.createRun({
        prompt: `${sub.prompt}\n\n这是订阅检查。请核对当前快照与基准的变化，保留前后证据和未知项。${template && template.prompt !== sub.prompt ? `\n已发布任务要求：${template.prompt}` : ''}`,
        mode: 'multi',
        provider: 'demo',
        dataset,
        subscriptionId: id,
        snapshot: parse(sub.agentSnapshot, agentSnapshot(this.store)),
      });
      this.store.exec('INSERT INTO scheduled_fires VALUES(?,?,?)', id, key, run.id);
      this.store.exec(
        'UPDATE subscriptions SET lastRunAt=?,lastRunId=?,nextFireAt=? WHERE id=?',
        now(),
        run.id,
        new Date(Date.now() + sub.intervalMinutes * 60000).toISOString(),
        id
      );

      return run;
    });
  }

  tick() {
    for (const r of this.store.all<{ id: string }>(
      "SELECT r.id FROM runs r LEFT JOIN subscription_processing p ON p.runId=r.id WHERE r.subscriptionId IS NOT NULL AND p.runId IS NULL AND r.status IN ('completed','partial','failed','cancelled')"
    ))
      this.process(this.store.run(r.id));
    for (const sub of this.store.subscriptions().filter((s) => s.enabled && s.nextFireAt <= now()))
      this.trigger(sub.id, sub.nextFireAt);
  }

  start() {
    if (this.timer) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
    this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
