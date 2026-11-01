import { AppError } from '../../../../packages/storage/index';
import type { AppContext } from '../../context';
import { getId, idParams } from '../../http/schema';
export function registerReportsRoutes({ app, store, runtime, subscriptions, options }: AppContext) {
  app.get('/api/reports', () => store.reports());

  app.get('/api/reports/:id/export', { schema: { params: idParams } }, (request, reply) => {
    const r = store.reports().find((r) => r.id === getId(request.params));
    if (!r) throw new AppError(404, '报告不存在');

    return reply
      .header('Content-Type', 'text/markdown; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="research-${r.id}.md"`)
      .send(r.content);
  });
}
