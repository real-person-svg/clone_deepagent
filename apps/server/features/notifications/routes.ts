import { now } from '../../../../packages/storage/index';
import type { AppContext } from '../../context';
import { getId, idParams } from '../../http/schema';
export function registerNotificationsRoutes({
  app,
  store,
  runtime,
  subscriptions,
  options,
}: AppContext) {
  app.get('/api/notifications', () => store.notifications());

  app.patch('/api/notifications/:id/read', { schema: { params: idParams } }, (request) => {
    store.exec('UPDATE notifications SET readAt=? WHERE id=?', now(), getId(request.params));

    return { ok: true };
  });
}
