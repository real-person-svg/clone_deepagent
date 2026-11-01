import type { Evidence, ModelMessage, NormalizedPrice } from '../../contracts/index';
import { percentChangeText } from '../../research/pricing/change-format';
import type { ModelRequest } from './types';
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
export function demoReport(
  request: ModelRequest,
  question: string,
  teamSize: number,
  competitor: string
) {
  const { agent, messages } = request;
  const sources = (
    (toolData(messages, 'query_evidence')?.sources || []) as (Evidence & { text?: string })[]
  ).map((e) => ({ ...e, content: e.content || e.text || '' }));
  const allPrices = (toolData(messages, 'normalize_pricing')?.prices || []) as NormalizedPrice[];
  const prices = competitor ? allPrices.filter((p) => p.competitor === competitor) : allPrices;

  const evidenceFor = (name: string, kind: string) =>
    sources.find((s) => s.competitor === name && s.id.includes(`_${kind}_`));
  let pricing = '当前没有可计算的结构化定价资料。';
  if (prices.length) {
    pricing = `| 产品 / 套餐 | 标价 | 团队月均成本 | 年成本 | 条件与来源 |\n|---|---|---:|---:|---|\n${prices.map((p) => `| ${p.competitor} ${p.plan} | ${p.currency} ${p.amount}/${p.billingPeriod === 'year' ? '年' : '月'}${p.unit === 'seat' ? '/席位' : '/空间'} | $${p.teamMonthly} | $${p.annualTotal} | ${p.conditions}；${citation(p.evidenceId, '定价证据')} |`).join('\n')}\n\n按 ${teamSize} 人团队计算。Beta 的 $19 是年付月均，最低三席，需要支付 $684/年。额度单位和质量口径不同，不能直接比较单次成本。`;
  }
  const product = ['Alpha', 'Beta', 'Gamma']
    .filter((name) => !competitor || name === competitor)
    .map((name) => {
      const f = evidenceFor(name, 'features'),
        t = evidenceFor(name, 'terms');

      return `- **${name}**：${f ? f.content.replace(/^.*\n/, '').slice(0, 260) + ' ' + citation(f.id, '能力来源') : '产品能力待核实'}${t ? `\n  商用授权：${t.content.replace(/^.*\n/, '').slice(0, 230)} ${citation(t.id, '授权来源')}` : ''}`;
    })
    .join('\n');
  const unknown =
    '付费用户数、营收、转化率和市场份额没有可用证据，均保留未知。Gamma 的公开 API 说明缺失，不能据此判断为不支持。供应商能力描述属于来源声明，尚未实测。';
  const strategy = `1. **自动化内容团队**：可验证 API、批量生成和品牌一致性的付费意愿。\n2. **多人运营团队**：可验证审核流、资产复用与权限协作的价值。\n3. **独立商家**：可验证低起步成本与明确商用授权是否提高选择意愿。\n\n这些是分析假设。建议访谈 3～5 位目标用户，并使用同一素材任务对比成本、质量和核验耗时，不能据此承诺收入或转化提升。`;
  const changes = toolData(messages, 'compare_snapshots')?.changes as
    | {
        competitor: string;
        field: string;
        oldValue: string;
        newValue: string;
        percent: string | null;
        oldEvidenceId: string;
        newEvidenceId: string;
      }[]
    | undefined;
  const changeText = changes?.length
    ? changes
        .map(
          (c) =>
            `- **${c.competitor} · ${c.field}**：${c.oldValue} → ${c.newValue}${percentChangeText(c.percent)}。${citation(c.oldEvidenceId, '前期证据')} · ${citation(c.newEvidenceId, '本期证据')}`
        )
        .join('\n')
    : '当前所选快照与基准没有已识别的商业化变化。';
  const history = toolData(messages, 'search_history')?.messages as
    | { role: string; content: string }[]
    | undefined;
  const historyText = history?.length
    ? `已读取当前会话 ${history.length} 条历史消息。最近的用户约束：“${history.find((m) => m.role === 'user')?.content.slice(0, 180) || '继续当前研究'}”。本次数值按当前选定快照重新计算。\n\n`
    : '';
  let content: string;
  if (agent.id === 'research')
    content = `已读取 ${sources.length} 份资料，覆盖定价、能力、条款、客群和更新记录。\n\n${sources
      .filter((s) => s.id.includes('_pricing_'))
      .map((s) => `- ${s.competitor}：${citation(s.id, s.title)}，观察时间 ${s.observedAt}`)
      .join('\n')}\n\n${unknown}`;
  else if (agent.id === 'pricing') content = pricing;
  else if (agent.id === 'product') content = `${product}\n\n${unknown}`;
  else if (agent.id === 'strategy') content = strategy;
  else if (agent.id === 'verifier')
    content = `已核对可引用证据和确定性价格计算。年付、席位与额度条件已保留。\n\n${changeText}\n\n${unknown}\n\n这是固定资料验收，语义判断仍应结合真实来源人工核对。`;
  else
    content = `# 竞品商业化研究\n\n> 离线演示 · 本报告使用虚构产品资料，用于验证 Agent 执行、证据与历史链路。\n\n${historyText}## 定价与套餐\n\n${pricing}\n\n## 产品与商用授权\n\n${product}\n\n${changes ? `## 跨期变化\n\n${changeText}\n\n` : ''}## 商业化建议\n\n${strategy}\n\n## 证据与未知项\n\n${unknown}\n\n资料快照：${request.dataset === 'baseline' ? '基准期 · 2026-10-25' : '变化期 · 2026-11-01'}。报告和本轮工具执行记录将完整保存。`;

  return content;
}
