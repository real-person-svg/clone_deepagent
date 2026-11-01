import type { ModelMessage, Run } from '../../contracts/index';
import type { Store } from '../../storage/index';
import type { Checkpoint } from './checkpoint';
export function conversationContext(store: Store, run: Run, goal: string): ModelMessage[] {
  const previous = store.all<{ role: 'user' | 'assistant'; content: string; runId: string }>(
    "SELECT role,content,runId FROM messages WHERE conversationId=? AND runId!=? AND status IN ('completed','partial') ORDER BY createdAt,rowid",
    run.conversationId,
    run.id
  );
  const groups = [...new Set(previous.map((m) => m.runId))];
  const recentGroups = new Set(groups.slice(-4));
  const old = previous.filter((m) => !recentGroups.has(m.runId));
  const messages: ModelMessage[] = [];
  if (old.length)
    messages.push({
      role: 'user',
      content: `以下为较早会话的历史摘录，仅供连续性参考；事实需重新核对证据：\n${old
        .slice(-12)
        .map((m) => `${m.role}: ${m.content.slice(0, 400)}`)
        .join('\n')}`,
    });
  for (const m of previous.filter((m) => recentGroups.has(m.runId))) {
    const reasoning =
      m.role === 'assistant'
        ? store.checkpoint<Checkpoint>(m.runId, 'root')?.finalReasoningContent
        : undefined;
    const message: ModelMessage = { role: m.role, content: m.content.slice(0, 6000) };
    if (reasoning !== undefined) message.reasoning_content = reasoning;
    messages.push(message);
  }
  messages.push({
    role: 'user',
    content: `${goal}\n\n本轮研究上下文：${run.provider === 'demo' ? '离线虚构资料' : '真实模型，仅可使用已导入或新采集来源'}；快照 ${run.dataset}。用户原始请求：${run.prompt}`,
  });

  return messages;
}
