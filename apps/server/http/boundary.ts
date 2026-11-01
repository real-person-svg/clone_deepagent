import type { FastifyInstance } from 'fastify';
import { AppError } from '../../../packages/storage/index';
export function registerHttpBoundary(app: FastifyInstance) {
  app.setErrorHandler((error, _req, reply) => {
    const validation = error instanceof Error && 'validation' in error;
    let status = 500;
    let message = '服务执行失败，请查看服务端日志';
    if (error instanceof AppError) {
      status = error.status;
      message = error.message;
    } else if (validation) {
      status = 400;
      message = '请求参数不合法';
    }
    if (status === 500) app.log.error(error);
    reply.code(status).send({
      error: message,
      code: error instanceof AppError ? error.code : 'SERVER_ERROR',
    });
  });

  app.addHook('onRequest', async (request, reply) => {
    const host = request.headers.host?.split(':')[0];
    if (host && !['127.0.0.1', 'localhost', '['].includes(host))
      return reply.code(403).send({ error: '此工作台仅接受本机访问' });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
        return reply.code(403).send({ error: '跨来源写入已拒绝' });
    }
  });
}
