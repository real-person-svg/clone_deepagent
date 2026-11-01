import { Cpu, Search, ShieldCheck } from 'lucide-react';
import type { AgentMode } from '../../../../../packages/contracts/index';
export const prompts = [
  {
    icon: Search,
    tag: '竞品研究',
    title: '梳理 AI 产品的商业化策略',
    text: '对比 Alpha、Beta、Gamma 的定价、套餐权益、目标客群和商用授权，给出有证据的商业化分析。',
    mode: 'multi' as AgentMode,
  },
  {
    icon: Cpu,
    tag: '定价分析',
    title: '算清真实的团队使用成本',
    text: '帮我比较三个竞品的套餐价格，按 3 人团队计算月均和年度成本，说明年付与最低席位限制。',
    mode: 'single' as AgentMode,
  },
  {
    icon: ShieldCheck,
    tag: '变化追踪',
    title: '发现价格与授权的变化',
    text: '对比当前快照与基准快照的商业化变化，列出价格、额度和商用授权的变化与前后证据。',
    mode: 'multi' as AgentMode,
  },
];

export const statusText: Record<string, string> = {
  queued: '等待执行',
  running: '正在执行',
  waiting_children: '子任务执行中',
  completed: '已完成',
  partial: '部分完成',
  failed: '执行失败',
  cancelled: '已停止',
};
