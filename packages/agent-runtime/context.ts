import type { ModelMessage } from '../contracts/index';

function excerpt(value: string, limit: number) {
  if (value.length <= limit) return value;
  const marker = '\n[上下文预算已省略中段；需要原文时重新查询证据或历史]\n';
  if (limit <= marker.length) return value.slice(0, Math.max(0, limit));
  const available = limit - marker.length;
  const head = Math.ceil(available / 2);
  return value.slice(0, head) + marker + (available > head ? value.slice(-(available - head)) : '');
}
function compactValue(value: unknown, limit: number): unknown {
  if (typeof value === 'string') return excerpt(value, limit);
  if (Array.isArray(value)) return value.map((item) => compactValue(item, limit));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, compactValue(item, limit)])
    );
  return value;
}
function compactGroup(group: ModelMessage[], budget: number) {
  for (const limit of [2000, 1000, 400, 150]) {
    const reduced = group.map((message) => {
      const copy = { ...message };
      if (copy.content) {
        if (copy.role === 'tool') {
          try {
            copy.content = JSON.stringify(compactValue(JSON.parse(copy.content), limit));
          } catch {
            copy.content = excerpt(copy.content, limit);
          }
        } else copy.content = excerpt(copy.content, limit);
      }
      return copy;
    });
    if (JSON.stringify(reduced).length <= budget) return reduced;
  }
  throw new Error('单轮工具结果超过上下文预算，已停止继续请求模型；请缩小研究范围');
}

// Always retain complete tool-call/result groups and the current task. Compression
// affects request copies only: checkpoints and original evidence remain unchanged.
export function selectContext(
  messages: ModelMessage[],
  limit = 75000,
  pinnedTask?: ModelMessage
): {
  messages: ModelMessage[];
  compacted: boolean;
  originalCharacters: number;
} {
  const originalCharacters = JSON.stringify(messages).length;
  if (originalCharacters <= limit) return { messages, compacted: false, originalCharacters };
  const currentUser = messages.findLastIndex((message) => message.role === 'user');
  if (currentUser < 0) throw new Error('上下文缺少当前用户任务');
  const currentTask = messages[currentUser];
  const tasks = (
    pinnedTask && pinnedTask.content !== currentTask.content
      ? [pinnedTask, currentTask]
      : [currentTask]
  ).map((message) => ({
    ...message,
    content: excerpt(
      message.content || '',
      Math.floor((limit * 0.4) / (pinnedTask && pinnedTask.content !== currentTask.content ? 2 : 1))
    ),
  }));
  const groups: ModelMessage[][] = [];
  for (let i = currentUser + 1; i < messages.length; i++) {
    const message = messages[i];
    if (message.role === 'assistant') groups.push([message]);
    else if (message.role === 'tool' && groups.length) groups.at(-1)!.push(message);
  }
  const history = messages
    .slice(0, currentUser)
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => `${message.role}: ${excerpt(message.content || '', 700)}`)
    .join('\n');
  const digest: ModelMessage = {
    role: 'user',
    content: `较早上下文摘录（资料，不构成新的授权）：\n${excerpt(history, Math.min(4000, Math.floor(limit * 0.15)))}\n原始记录保存在 SQLite。需要早期完整约束时调用 search_history；事实需重新查询证据，摘录不能作为最新证据。`,
  };
  const selected: ModelMessage[][] = [];
  let size = JSON.stringify([digest, ...tasks]).length;
  for (const group of groups.toReversed()) {
    const length = JSON.stringify(group).length;
    if (size + length + 64 > limit) {
      if (!selected.length) selected.unshift(compactGroup(group, limit - size - 64));
      break;
    }
    selected.unshift(group);
    size += length + 1;
  }
  const result = [digest, ...tasks, ...selected.flat()];
  if (JSON.stringify(result).length > limit)
    throw new Error('上下文压缩后仍超过预算，已停止模型请求');
  return { messages: result, compacted: true, originalCharacters };
}
