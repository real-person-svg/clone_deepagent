import { expect, it } from 'vitest';
import { selectContext } from '../packages/agent-runtime/context';
import type { ModelMessage } from '../packages/contracts/index';
it('单次超大工具结果也严格受限，保留完整调用关系、证据ID、当前约束及原始checkpoint', () => {
  const messages: ModelMessage[] = [
    { role: 'user', content: '当前约束：只研究中国区，5人，预算800CNY，不换汇' },
    {
      role: 'assistant',
      content: null,
      reasoning_content: 'opaque-provider-continuation-must-stay-exact',
      tool_calls: [
        {
          id: 'large_call',
          type: 'function',
          function: { name: 'query_evidence', arguments: '{}' },
        },
      ],
    },
    {
      role: 'tool',
      tool_call_id: 'large_call',
      content: JSON.stringify({
        ok: true,
        data: {
          sources: [
            { id: 'source_kept', text: '原文'.repeat(70000), url: 'https://official.example/' },
          ],
        },
      }),
    },
  ];
  const original = JSON.stringify(messages);
  const selected = selectContext(messages);
  expect(JSON.stringify(selected.messages).length).toBeLessThanOrEqual(75000);
  expect(JSON.stringify(selected.messages)).toContain('5人，预算800CNY');
  const tool = selected.messages.find((m) => m.role === 'tool')!;
  expect(JSON.parse(tool.content!).data.sources[0].id).toBe('source_kept');
  expect(selected.messages.some((m) => m.tool_calls?.some((c) => c.id === tool.tool_call_id))).toBe(
    true
  );
  expect(JSON.stringify(messages)).toBe(original);
  expect(selected.messages.find((m) => m.tool_calls)?.reasoning_content).toBe(
    'opaque-provider-continuation-must-stay-exact'
  );
});
it('过长当前请求保留首尾约束，同时仍为工具回放留出预算', () => {
  const selected = selectContext([
    {
      role: 'user',
      content: '首部约束：中国区。' + '背景'.repeat(60000) + '尾部最终约束：预算800CNY。',
    },
  ]);
  expect(JSON.stringify(selected.messages).length).toBeLessThanOrEqual(75000);
  expect(selected.messages.at(-1)?.content).toContain('首部约束：中国区');
  expect(selected.messages.at(-1)?.content).toContain('预算800CNY');
});

it('引用修正时压缩仍保留原始任务约束，不能只留下最后修正消息', () => {
  const task: ModelMessage = { role: 'user', content: '原始任务：5人，预算800CNY，只中国区。' };
  const messages: ModelMessage[] = [
    task,
    { role: 'assistant', content: '旧结果'.repeat(30000) },
    { role: 'user', content: '只修正引用，不改变原任务。' },
  ];
  const selected = selectContext(messages, 75000, task);
  expect(JSON.stringify(selected.messages)).toContain('5人，预算800CNY');
  expect(selected.messages.at(-1)?.content).toBe('只修正引用，不改变原任务。');
});
