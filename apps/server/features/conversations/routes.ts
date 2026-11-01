import type { AgentMode } from '../../../../packages/contracts/index';
import { terminalStatuses } from '../../../../packages/contracts/index';
import { AppError, now } from '../../../../packages/storage/index';
import type { AppContext } from '../../context';
import { body, getId, idParams, text } from '../../http/schema';
export function registerConversationsRoutes({
  app,
  store,
  runtime,
  subscriptions,
  options,
}: AppContext) {
  app.get('/api/conversations', (request) =>
    store.conversations(String((request.query as { search?: string }).search || ''))
  );

  app.post(
    '/api/conversations',
    { schema: { body: body({ title: text(100), mode: { enum: ['single', 'multi'] } }) } },
    (request) => {
      const p = request.body as { title?: string; mode?: AgentMode };

      return store.createConversation(p.title, p.mode);
    }
  );

  app.get('/api/conversations/:id', { schema: { params: idParams } }, (request) =>
    store.detail(getId(request.params))
  );

  app.patch(
    '/api/conversations/:id',
    { schema: { params: idParams, body: body({ title: text(100) }, ['title']) } },
    (request) => {
      const id = getId(request.params);
      store.detail(id);
      store.exec(
        'UPDATE conversations SET title=?,updatedAt=? WHERE id=?',
        (request.body as { title: string }).title.trim(),
        now(),
        id
      );

      return store.detail(id);
    }
  );

  app.delete('/api/conversations/:id', { schema: { params: idParams } }, (request) => {
    const id = getId(request.params);
    const c = store.detail(id);
    if (c.runs.some((r) => !terminalStatuses.includes(r.status)))
      throw new AppError(409, '请先停止当前任务再删除会话');
    store.exec('DELETE FROM conversations WHERE id=?', id);

    return { ok: true };
  });
}
