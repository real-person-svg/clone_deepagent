import type { AgentMode, ProviderMode } from '../../../../packages/contracts/index';
import { terminalStatuses } from '../../../../packages/contracts/index';
import { AppError } from '../../../../packages/storage/index';
import type { AppContext } from '../../context';
import { body, getId, idParams, text } from '../../http/schema';
export function registerRunsRoutes({ app, store, runtime, subscriptions, options }: AppContext) {
  app.post(
    '/api/runs',
    {
      schema: {
        body: body(
          {
            conversationId: text(200),
            prompt: text(),
            agentId: text(200),
            mode: { enum: ['single', 'multi'] },
            provider: { enum: ['live'] },
          },
          ['prompt']
        ),
      },
    },
    (request) => {
      const p = request.body as {
        conversationId?: string;
        prompt: string;
        mode?: AgentMode;
        agentId?: string;
        provider?: ProviderMode;
      };
      if (!p.prompt.trim()) throw new AppError(400, '请输入研究问题');
      if (!runtime.liveConfigured)
        throw new AppError(
          400,
          '请先在服务端配置 MODEL_BASE_URL 和 MODEL_NAME',
          'MODEL_NOT_CONFIGURED'
        );
      const agent = store.agents().find((a) => a.id === (p.agentId || 'root'));
      if (!agent) throw new AppError(404, '数字员工不存在或未发布', 'AGENT_NOT_FOUND');
      const run = store.createRun({
        ...p,
        provider: 'live',
        agentId: agent.id,
        mode: p.mode || (agent.tools.includes('delegate_tasks') ? 'multi' : 'single'),
        prompt: p.prompt.trim(),
      });
      runtime.pump();

      return run;
    }
  );

  app.get('/api/runs/:id', { schema: { params: idParams } }, (request) => ({
    run: store.run(getId(request.params)),
    tasks: store.all(
      'SELECT id,taskKey,agent,status,result,error FROM tasks WHERE runId=? ORDER BY createdAt',
      getId(request.params)
    ),
  }));

  app.get(
    '/api/runs/:id/event-log',
    {
      schema: {
        params: idParams,
        querystring: body({ afterSeq: { type: 'integer', minimum: 0 } }),
      },
    },
    (request) => {
      const id = getId(request.params);
      store.run(id);

      return store.events(id, Number((request.query as { afterSeq?: number }).afterSeq || 0));
    }
  );

  app.post('/api/runs/:id/cancel', { schema: { params: idParams } }, (request) =>
    runtime.cancel(getId(request.params))
  );

  app.get(
    '/api/runs/:id/events',
    {
      schema: {
        params: idParams,
        querystring: body({ afterSeq: { type: 'integer', minimum: 0 } }),
      },
    },
    async (request, reply) => {
      const id = getId(request.params);
      store.run(id);
      let cursor = Number(
        (request.query as { afterSeq?: number }).afterSeq || request.headers['last-event-id'] || 0
      );
      if (!Number.isSafeInteger(cursor) || cursor < 0) throw new AppError(400, '事件游标不合法');
      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      reply.raw.write(`event: snapshot\ndata: ${JSON.stringify(store.run(id))}\n\n`);
      let closed = false,
        sending = false;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        store.changes.off(id, send);
      };

      const send = () => {
        if (closed || sending) return;
        sending = true;
        try {
          const events = store.events(id, cursor);
          for (const e of events) {
            cursor = e.seq;
            if (
              !reply.raw.write(`id: ${e.seq}\nevent: run-event\ndata: ${JSON.stringify(e)}\n\n`)
            ) {
              reply.raw.once('drain', send);
              break;
            }
          }
          const run = store.run(id);
          const latest = store.get<{ seq: number }>(
            'SELECT coalesce(max(seq),0) seq FROM run_events WHERE runId=?',
            id
          )!.seq;
          if (terminalStatuses.includes(run.status) && cursor >= latest) {
            cleanup();
            reply.raw.end();
          }
        } catch {
          cleanup();
          reply.raw.end();
        } finally {
          sending = false;
        }
      };
      const interval = setInterval(() => {
        if (!closed) {
          reply.raw.write(': heartbeat\n\n');
          send();
        }
      }, 2000);
      reply.raw.on('close', cleanup);
      store.changes.on(id, send);
      send();
    }
  );
}
