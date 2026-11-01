import 'dotenv/config';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../apps/server/app';
import { conversationContext } from '../packages/agent-runtime/execution/conversation-context';
import { now } from '../packages/storage/index';
import type { Run } from '../packages/contracts/index';

// Explicit, repeatable integration evaluation. Never run by the offline test suite.
if (process.env.RUN_LIVE_EVALUATION !== '1')
  throw new Error('Set RUN_LIVE_EVALUATION=1 to authorize real network/model usage');
if (!process.env.MODEL_BASE_URL || !process.env.MODEL_NAME) throw new Error('MODEL_NOT_CONFIGURED');
const directory = mkdtempSync(join(tmpdir(), 'agent-live-evaluation-'));
console.log(JSON.stringify({ phase: 'start', directory }));
const { app, store, runtime } = await createApp({
  databasePath: join(directory, 'workspace.sqlite'),
  startWorkers: false,
  live: {
    baseUrl: process.env.MODEL_BASE_URL,
    model: process.env.MODEL_NAME,
    apiKey: process.env.MODEL_API_KEY || '',
    timeoutMs: 120000,
  },
});
const summaries: Record<string, unknown>[] = [];
async function execute(label: string, run: Run) {
  const timer = setInterval(() => {
    const events = store.events(run.id);
    const last = events.at(-1);
    console.log(
      JSON.stringify({
        phase: 'progress',
        label,
        status: store.run(run.id).status,
        lastEvent: last?.type,
        lastTool: last?.data.name,
        tools: store.all('SELECT id FROM tool_calls WHERE runId=?', run.id).length,
      })
    );
  }, 15000);
  try {
    await runtime.idle(480000);
  } finally {
    clearInterval(timer);
  }
  const final = store.run(run.id);
  const tools = store.all<{ name: string; result: string }>(
    'SELECT name,result FROM tool_calls WHERE runId=? ORDER BY createdAt,rowid',
    run.id
  );
  const events = store.events(run.id);
  const report = store.reports().find((r) => r.runId === run.id);
  const summary = {
    label,
    status: final.status,
    agentId: final.agentId,
    error: final.error,
    toolNames: tools.map((t) => t.name),
    failedTools: tools
      .filter((t) => JSON.parse(t.result || '{}').ok === false)
      .map((t) => ({ name: t.name, error: JSON.parse(t.result).error })),
    evidenceIds: report?.evidenceIds || [],
    compactions: events.filter((e) => e.type === 'context.compacted').map((e) => e.data),
    usage: store.get(
      'SELECT count(*) requests,sum(inputTokens) inputTokens,sum(outputTokens) outputTokens FROM usage_records WHERE runId=?',
      run.id
    ),
  };
  summaries.push(summary);
  writeFileSync(join(directory, `${label}.md`), final.answer);
  writeFileSync(join(directory, 'summary.json'), JSON.stringify(summaries, null, 2));
  console.log(JSON.stringify({ phase: 'finished', ...summary }));
  return final;
}
try {
  const first = store.createRun({
    agentId: 'research',
    mode: 'single',
    provider: 'live',
    prompt:
      '请自行联网检索并整理“剪映中国区与 CapCut 国际版”的商业化来源研究报告；用户没有提供 URL。先明确两个地区不可混为同一套餐。检索官方产品、套餐、帮助或授权页面，最多3轮检索、6个页面采集。必须 fetch_source 保存正文再引用，搜索摘要不能用作事实。用不超过900字输出：来源覆盖表、至少3项关键事实（尽量逐字短引原文并引用）、价格/周期/商用授权的未知项与采集失败。不能用模型记忆补价格；没有正文证据就明确未知。',
  });
  const sourceRun = await execute('source-research', first);
  const sources = store.evidence();
  if (sources.length) {
    const audit = store.createRun({
      conversationId: first.conversationId,
      agentId: 'verifier',
      mode: 'single',
      provider: 'live',
      prompt:
        '请独立核验上一份来源研究报告。必须 query_evidence 读取已保存原文，逐条检查关键事实和推断是否被原文支持。特别核对：是否由不同域名推断不同法律主体；是否由无需信用卡推断无需登录；搜索摘要是否混入事实；价格、商用授权、地区与缺失项是否如实。输出核验表（结论/原文/支持或不支持/修正），最后给出修正后的简短结论，均引用证据。不要做额外网络搜索。',
    });
    await execute('independent-audit', audit);
  }
  writeFileSync(join(directory, 'sources.json'), JSON.stringify(sources, null, 2));
  if (sources.length) {
    // Controlled context pressure: repeat genuine captured text, never invent market facts.
    const anchor = store.createRun({
      conversationId: first.conversationId,
      agentId: 'root',
      mode: 'single',
      provider: 'live',
      prompt: `上下文压力测试资料（复制的官方原文，不新增事实）：${sources[0].content.repeat(2).slice(0, 12000)}\n最终约束代号 SCOPE-800：只研究剪映中国区；5人团队；月预算800 CNY；禁止换汇；不得用 CapCut 国际版价格代替中国区价格；没有席位或授权证据必须标为未知。`,
    });
    store.finish(
      anchor.id,
      'completed',
      '已记录约束；事实继续以官方原文为准。（上下文压力测试注入记录）'
    );
    for (let i = 0; i < 5; i++) {
      const filler = store.createRun({
        conversationId: first.conversationId,
        agentId: 'root',
        mode: 'single',
        provider: 'live',
        prompt: `上下文压力测试回放 ${i + 1}：${sources[i % sources.length].content.slice(0, 8000)}`,
      });
      store.finish(filler.id, 'completed', sourceRun.answer);
    }
    const follow = store.createRun({
      conversationId: first.conversationId,
      agentId: 'root',
      mode: 'single',
      provider: 'live',
      prompt:
        '请继续这段历史研究，先使用 search_history 找回 SCOPE-800 的最终约束，不要沿用更早的比较范围。读取现有真实证据，按最新约束输出500字内的商业化判断与未知项，结尾列出实际采用的产品地区、人数、预算和换汇规则。不得把测试回放文本当作新增事实。无需再做广泛网络检索。',
    });
    const call = {
      id: 'context_pressure',
      type: 'function' as const,
      function: { name: 'query_evidence', arguments: '{}' },
    };
    const response = {
      ok: true,
      data: {
        sources: sources
          .slice(0, 3)
          .map((s) => ({ id: s.id, title: s.title, url: s.url, text: s.content.repeat(15) })),
      },
    };
    const messages = [
      ...conversationContext(store, follow, follow.prompt),
      { role: 'assistant' as const, content: null, reasoning_content: '', tool_calls: [call] },
      { role: 'tool' as const, tool_call_id: call.id, content: JSON.stringify(response) },
    ];
    store.saveCheckpoint(follow.id, 'root', { messages, step: 1, pending: [] });
    for (const source of sources.slice(0, 3))
      store.exec('INSERT OR IGNORE INTO run_evidence VALUES(?,?)', follow.id, source.id);
    store.event(follow.id, 'evaluation.context_pressure', 'root', {
      characters: JSON.stringify(messages).length,
      note: 'genuine source text repeated for budget/replay evaluation only',
    });
    await execute('context-followup', follow);
  }
  const cancel = store.createRun({
    agentId: 'research',
    mode: 'single',
    provider: 'live',
    prompt: '稳定性取消验证：请自行搜索剪映官方授权资料并整理原文引用。',
  });
  runtime.pump();
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline && !store.events(cancel.id).some((e) => e.type === 'model.started'))
    await new Promise((r) => setTimeout(r, 25));
  runtime.cancel(cancel.id);
  await runtime.idle();
  summaries.push({
    label: 'live-cancellation',
    status: store.run(cancel.id).status,
    reports: store.reports().filter((r) => r.runId === cancel.id).length,
  });
  writeFileSync(join(directory, 'summary.json'), JSON.stringify(summaries, null, 2));
  const required = ['source-research', 'independent-audit', 'context-followup'];
  const failures = required.filter(
    (label) => !summaries.some((item) => item.label === label && item.status === 'completed')
  );
  const context = summaries.find((item) => item.label === 'context-followup');
  if (
    !context ||
    !(context.toolNames as string[]).includes('search_history') ||
    !(context.compactions as { selectedCharacters: number }[]).length ||
    (context.compactions as { selectedCharacters: number }[]).some(
      (event) => event.selectedCharacters > 75000
    )
  )
    failures.push('context-budget-or-retrieval');
  const notices = store.reports();
  if (
    notices.some((report) => report.evidenceIds.some((id) => store.getEvidence(id).kind !== 'web'))
  )
    failures.push('non-web-evidence');
  if (
    store.run(cancel.id).status !== 'cancelled' ||
    notices.some((report) => report.runId === cancel.id)
  )
    failures.push('cancellation');
  writeFileSync(
    join(directory, 'checks.json'),
    JSON.stringify(
      {
        passed: !failures.length,
        failures,
        note: 'Semantic accuracy still requires review against saved original text',
      },
      null,
      2
    )
  );
  if (failures.length) process.exitCode = 1;
  console.log(JSON.stringify({ phase: 'complete', directory, summary: summaries, failures }));
} finally {
  await app.close();
}
