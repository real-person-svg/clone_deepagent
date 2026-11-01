import { Subscriptions } from '../../../../packages/research/subscriptions';
import { AppError, uid } from '../../../../packages/storage/index';
import type { AppContext } from '../../context';
import { body, getId, idParams, text } from '../../http/schema';
export function registerSubscriptionsRoutes({
  app,
  store,
  runtime,
  subscriptions,
  options,
}: AppContext) {
  app.get('/api/subscriptions', () => store.subscriptions());

  app.get('/api/task-templates', () => subscriptions.templates());

  app.post(
    '/api/task-templates',
    {
      schema: {
        body: body(
          {
            id: text(200),
            name: text(100),
            prompt: text(4000),
            revision: { type: 'integer', minimum: 1 },
            publish: { type: 'boolean' },
          },
          ['name', 'prompt', 'publish']
        ),
      },
    },
    (request) =>
      subscriptions.saveTemplate(request.body as Parameters<Subscriptions['saveTemplate']>[0])
  );

  app.post(
    '/api/subscriptions',
    {
      schema: {
        body: body(
          {
            name: text(100),
            prompt: text(4000),
            templateId: text(200),
            intervalMinutes: { type: 'integer', minimum: 1, maximum: 43200 },
            sourceIds: {
              type: 'array',
              minItems: 1,
              maxItems: 10,
              uniqueItems: true,
              items: text(200),
            },
          },
          ['name', 'prompt', 'intervalMinutes', 'sourceIds']
        ),
      },
    },
    (request) => subscriptions.create(request.body as Parameters<Subscriptions['create']>[0])
  );

  app.patch(
    '/api/subscriptions/:id',
    {
      schema: {
        params: idParams,
        body: body(
          {
            enabled: { type: 'boolean' },
            name: text(100),
            intervalMinutes: { type: 'integer', minimum: 1, maximum: 43200 },
            revision: { type: 'integer', minimum: 1 },
          },
          ['revision']
        ),
      },
    },
    (request) =>
      subscriptions.update(
        getId(request.params),
        request.body as Parameters<Subscriptions['update']>[1]
      )
  );

  app.post(
    '/api/subscriptions/:id/check',
    { schema: { params: idParams, body: body({ key: text(200) }) } },
    (request) => {
      const run = subscriptions.trigger(
        getId(request.params),
        (request.body as { key?: string }).key || uid('manual')
      );
      runtime.pump();

      return run;
    }
  );

  app.delete('/api/subscriptions/:id', { schema: { params: idParams } }, (request) => {
    const id = getId(request.params);
    subscriptions.find(id);
    if (
      store.get(
        "SELECT id FROM runs WHERE subscriptionId=? AND status IN ('queued','running','waiting_children')",
        id
      )
    )
      throw new AppError(409, '请先等待或停止订阅任务');
    store.exec('DELETE FROM subscriptions WHERE id=?', id);

    return { ok: true };
  });
}
