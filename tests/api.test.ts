import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../apps/server/app';
import { HttpModel } from '../packages/agent-runtime/model';
import { defaultAgents } from '../packages/research/fixtures';

const apps: Awaited<ReturnType<typeof createApp>>[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const a of apps.splice(0)) await a.app.close();
});
async function setup() {
  const a = await createApp({ databasePath: ':memory:', startWorkers: false });
  apps.push(a);
  return a;
}

it('API 提交、历史查询、按序号回放 SSE、导出报告、重命名和删除闭环', async () => {
  const { app, runtime } = await setup();
  const response = await app.inject({
    method: 'POST',
    url: '/api/runs',
    payload: { prompt: '比较 3 人团队价格', mode: 'single', provider: 'demo' },
  });
  expect(response.statusCode).toBe(200);
  const run = response.json();
  await runtime.idle();
  const detail = (await app.inject(`/api/conversations/${run.conversationId}`)).json();
  expect(detail.messages).toHaveLength(2);
  expect(detail.runs[0].status).toBe('completed');
  const stream = await app.inject(`/api/runs/${run.id}/events?afterSeq=4`);
  expect(stream.headers['content-type']).toContain('text/event-stream');
  const ids = [...stream.body.matchAll(/^id: (\d+)/gm)].map((m) => Number(m[1]));
  expect(ids.length).toBeGreaterThan(0);
  expect(Math.min(...ids)).toBe(5);
  expect(new Set(ids).size).toBe(ids.length);
  expect((await app.inject(`/api/reports/report_${run.id}/export`)).body).toContain('684.00');
  expect(
    (
      await app.inject({
        method: 'PATCH',
        url: `/api/conversations/${run.conversationId}`,
        payload: { title: '价格比较' },
      })
    ).json().title
  ).toBe('价格比较');
  expect(
    (await app.inject({ method: 'DELETE', url: `/api/conversations/${run.conversationId}` }))
      .statusCode
  ).toBe(200);
  expect((await app.inject(`/api/conversations/${run.conversationId}`)).statusCode).toBe(404);
});
it('参数、来源边界、未配置模型与未知证据引用受校验', async () => {
  const { app } = await setup();
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/runs',
        payload: { prompt: 'x', mode: 'invalid', provider: 'demo' },
      })
    ).statusCode
  ).toBe(400);
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/runs',
        payload: { prompt: 'x', mode: 'single', provider: 'live' },
      })
    ).json().code
  ).toBe('MODEL_NOT_CONFIGURED');
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/conversations',
        headers: { origin: 'https://untrusted.example' },
        payload: {},
      })
    ).statusCode
  ).toBe(403);
  expect((await app.inject('/api/evidence/missing')).statusCode).toBe(404);
  const upload = await app.inject({
    method: 'POST',
    url: '/api/documents',
    payload: {
      title: '己方产品',
      competitor: '我的产品',
      content: '团队计划每月 50 美元。此为用户提供待核实资料。',
    },
  });
  expect(upload.statusCode).toBe(200);
  expect(upload.json().kind).toBe('upload');
});
it('历史追问默认沿用前次快照，明确请求更新时才刷新来源', async () => {
  const { app, runtime } = await setup();
  const first = (
    await app.inject({
      method: 'POST',
      url: '/api/runs',
      payload: { prompt: '按3人比较套餐', mode: 'single', provider: 'demo' },
    })
  ).json();
  await runtime.idle();
  await app.inject({ method: 'PATCH', url: '/api/workspace', payload: { dataset: 'updated' } });
  const follow = (
    await app.inject({
      method: 'POST',
      url: '/api/runs',
      payload: {
        conversationId: first.conversationId,
        prompt: '继续解释年付条件',
        mode: 'single',
        provider: 'demo',
      },
    })
  ).json();
  expect(follow.dataset).toBe('baseline');
  await runtime.idle();
  const refreshed = (
    await app.inject({
      method: 'POST',
      url: '/api/runs',
      payload: {
        conversationId: first.conversationId,
        prompt: '现在刷新资料，看看有什么变化',
        mode: 'single',
        provider: 'demo',
      },
    })
  ).json();
  expect(refreshed.dataset).toBe('updated');
  await runtime.idle();
});
it('真实模型适配器拼接分片工具参数和文本，记录用量', async () => {
  const frames =
    [
      {
        choices: [
          {
            delta: {
              content: '正在核对',
              reasoning_content: 'opaque-provider-state-1',
              tool_calls: [
                { index: 0, id: 'c1', function: { name: 'query_evidence', arguments: '{"que' } },
              ],
            },
          },
        ],
      },
      {
        choices: [
          {
            delta: {
              reasoning_content: '-2',
              tool_calls: [{ index: 0, function: { arguments: 'ry":"pricing"}' } }],
            },
          },
        ],
      },
      {
        choices: [{ delta: {}, finish_reason: 'tool_calls' }],
        usage: { prompt_tokens: 20, completion_tokens: 10 },
      },
    ]
      .map((v) => `data: ${JSON.stringify(v)}\r\n\r\n`)
      .join('') + 'data: [DONE]\r\n\r\n';
  const bytes = new TextEncoder().encode(frames);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      new ReadableStream({
        start(controller) {
          for (let i = 0; i < bytes.length; i += 17) controller.enqueue(bytes.slice(i, i + 17));
          controller.close();
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } }
    )
  );
  let text = '';
  const model = new HttpModel({
    baseUrl: 'https://model.example/v1',
    model: 'test-model',
    apiKey: 'test-only',
  });
  const reply = await model.complete({
    agent: defaultAgents[0],
    messages: [{ role: 'user', content: '研究问题' }],
    tools: [],
    dataset: 'baseline',
    signal: new AbortController().signal,
    onText: (s) => (text += s),
  });
  expect(text).toBe('正在核对');
  expect(reply.toolCalls[0].function.arguments).toBe('{"query":"pricing"}');
  expect(reply.usage).toEqual({ input: 20, output: 10 });
  expect(reply.reasoningContent).toBe('opaque-provider-state-1-2');
  expect(text).not.toContain('opaque-provider-state');
});
it('模型流中途断开不能被当作成功回答', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('data: {"choices":[{"delta":{"content":"尚未完成"}}]}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  );
  const model = new HttpModel({
    baseUrl: 'https://model.example/v1',
    model: 'test-model',
    apiKey: 'test-only',
  });
  await expect(
    model.complete({
      agent: defaultAgents[0],
      messages: [{ role: 'user', content: '研究问题' }],
      tools: [],
      dataset: 'baseline',
      signal: new AbortController().signal,
      onText: () => {},
    })
  ).rejects.toThrow('提前中断');
});
