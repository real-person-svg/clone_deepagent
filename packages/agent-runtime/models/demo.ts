import type { ModelMessage, ModelReply } from '../../contracts/index';
import { uid } from '../../storage/index';
import { demoReport } from './demo-report';
import type { ModelAdapter, ModelRequest } from './types';
const call = (name: string, args: unknown): ModelReply => ({
  content: '',
  toolCalls: [
    { id: uid('call'), type: 'function', function: { name, arguments: JSON.stringify(args) } },
  ],
});

const toolData = (messages: ModelMessage[], name: string) => {
  const calls = messages.flatMap((m) => m.tool_calls || []).filter((c) => c.function.name === name);
  const result = calls
    .map((c) => messages.find((m) => m.role === 'tool' && m.tool_call_id === c.id))
    .filter(Boolean)
    .at(-1);
  try {
    return JSON.parse(result?.content || '{}').data;
  } catch {
    return undefined;
  }
};

const citation = (id: string, label: string) => `[${label}](/evidence/${id})`;
export class DemoModel implements ModelAdapter {
  async complete(request: ModelRequest): Promise<ModelReply> {
    const { agent, messages, tools } = request;
    const steps = messages.filter((m) => m.role === 'assistant' && m.tool_calls?.length).length;
    const question = (messages.filter((m) => m.role === 'user').at(-1)?.content || '').split(
      '\n\n本轮研究上下文：'
    )[0];
    const allowed = tools.map((t) => t.function.name);
    const teamInput =
      [
        question,
        ...messages
          .filter((m) => m.role === 'user')
          .map((m) => m.content || '')
          .reverse(),
      ].find((s) => /\d+\s*[人席]|三人/.test(s)) || question;
    const teamMatch = teamInput.match(/(\d+)\s*[人席]/);
    const teamSize = Math.min(10000, Number(teamMatch?.[1] || (/三人/.test(teamInput) ? 3 : 1)));
    const names = ['Alpha', 'Beta', 'Gamma'].filter((name) =>
      question.toLowerCase().includes(name.toLowerCase())
    );
    const competitor = names.length === 1 ? names[0] : '';
    const multi = allowed.includes('delegate_tasks');
    if (agent.id === 'root' && multi) {
      if (steps === 0) return call('list_competitors', {});
      if (steps === 1)
        return call('delegate_tasks', {
          tasks: [
            { agent: 'research', goal: `核对来源覆盖、资料性质和未知项。用户问题：${question}` },
          ],
        });
      if (steps === 2)
        return call('delegate_tasks', {
          tasks: [
            {
              agent: 'pricing',
              goal: `比较价格、年付条件、最低席位；按 ${teamSize} 人计算。用户问题：${question}`,
            },
            { agent: 'product', goal: `比较客群、产品能力和商用授权。用户问题：${question}` },
          ],
        });
      if (steps === 3)
        return call('delegate_tasks', {
          tasks: [
            {
              agent: 'strategy',
              goal: `结合已完成子任务，给出差异化假设和验证动作。用户问题：${question}`,
            },
          ],
        });
      if (steps === 4)
        return call('delegate_tasks', {
          tasks: [
            {
              agent: 'verifier',
              goal: `核对来源、价格口径、跨期变化和未知项。用户问题：${question}`,
            },
          ],
        });
      const delegated = messages
        .filter((m) => m.role === 'tool')
        .flatMap((m) => {
          try {
            return JSON.parse(m.content || '{}').data?.tasks || [];
          } catch {
            return [];
          }
        });
      const content = `# AI 商业化竞品分析\n\n> 离线演示 · Alpha、Beta、Gamma 均为虚构测试产品。以下结果来自实际执行的工具与子任务，不代表真实市场。\n\n研究问题：${question}\n\n${delegated.map((t: { name: string; result: string }) => `## ${t.name}\n\n${t.result}`).join('\n\n')}\n\n---\n\n已完成资料、定价、产品、策略和证据核验协作。报告与证据快照已保存，可继续追问或建立变化订阅。`;

      return this.answer(content, request);
    }
    let plan: { name: string; args: unknown }[];
    if (agent.id === 'root') {
      plan = [
        {
          name: /之前|刚才|上次|历史|继续|记得/.test(question)
            ? 'search_history'
            : 'list_competitors',
          args: {},
        },
        { name: 'query_evidence', args: { competitor } },
        { name: 'normalize_pricing', args: { teamSize } },
      ];
      if (/变化|更新|前后|昨天|上涨/.test(question))
        plan.push({ name: 'compare_snapshots', args: { threshold: 0 } });
    } else if (agent.id === 'pricing')
      plan = [
        { name: 'query_evidence', args: { competitor } },
        { name: 'normalize_pricing', args: { teamSize } },
      ];
    else if (agent.id === 'verifier')
      plan = [
        { name: 'query_evidence', args: {} },
        { name: 'normalize_pricing', args: { teamSize } },
        { name: 'compare_snapshots', args: { threshold: 0 } },
      ];
    else if (agent.id === 'strategy')
      plan = [
        { name: 'query_evidence', args: { competitor } },
        { name: 'search_history', args: {} },
      ];
    else
      plan = [
        { name: 'list_competitors', args: {} },
        { name: 'query_evidence', args: { competitor } },
      ].filter((p) => allowed.includes(p.name));
    if (steps < plan.length) return call(plan[steps].name, plan[steps].args);
    const content = demoReport(request, question, teamSize, competitor);

    return this.answer(content, request);
  }
  private async answer(content: string, request: ModelRequest): Promise<ModelReply> {
    for (let i = 0; i < content.length; i += 100) {
      if (request.signal.aborted) throw new Error('任务已停止');
      request.onText(content.slice(i, i + 100));
      await new Promise((resolve) => setTimeout(resolve, 6));
    }

    return { content, toolCalls: [] };
  }
}
