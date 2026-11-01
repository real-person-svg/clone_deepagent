import type { TaskTemplate } from '../../contracts/index';
import { AppError, now, Store, uid } from '../../storage/index';
import { agentSnapshot } from './agent-snapshot';
export class TaskTemplates {
  constructor(private store: Store) {}
  list() {
    return this.store.all<TaskTemplate>('SELECT * FROM task_templates ORDER BY rowid');
  }
  save(input: { id?: string; name: string; prompt: string; revision?: number; publish: boolean }) {
    return this.store.tx(() => {
      const id = input.id || uid('tpl');
      const old = this.list().find((t) => t.id === id);
      if (input.id && !old) throw new AppError(404, '任务模板不存在');
      if (old && input.revision !== old.draftRevision)
        throw new AppError(409, '模板已更新，请刷新后重试');
      const version = input.publish ? (old?.publishedVersion || 0) + 1 : old?.publishedVersion || 0;
      this.store.exec(
        'INSERT INTO task_templates VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,prompt=excluded.prompt,draftPrompt=excluded.draftPrompt,draftRevision=excluded.draftRevision,publishedVersion=excluded.publishedVersion,updatedAt=excluded.updatedAt',
        id,
        input.name,
        input.publish ? input.prompt : old?.prompt || '',
        input.prompt,
        (old?.draftRevision || 0) + 1,
        version,
        now()
      );
      if (input.publish)
        this.store.exec(
          'INSERT INTO task_template_versions VALUES(?,?,?,?,?)',
          id,
          version,
          input.prompt,
          JSON.stringify(agentSnapshot(this.store)),
          now()
        );

      return this.list().find((t) => t.id === id)!;
    });
  }
}
