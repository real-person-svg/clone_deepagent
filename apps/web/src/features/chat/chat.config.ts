import { Cpu, Search, ShieldCheck } from 'lucide-react';
export const prompts = [
  {
    icon: Search,
    tag: '竞品研究',
    title: '梳理 AI 产品的商业化策略',
    text: '基于我导入的竞品资料，对比定价、套餐权益、目标客群和商用授权。先确认产品、地区和观察时间，引用官方原文，缺少证据时列出待补充来源。',
  },
  {
    icon: Cpu,
    tag: '定价分析',
    title: '算清真实的团队使用成本',
    text: '帮我比较三个竞品的套餐价格，按 3 人团队计算月均和年度成本，说明年付与最低席位限制。',
  },
  {
    icon: ShieldCheck,
    tag: '变化追踪',
    title: '发现价格与授权的变化',
    text: '刷新已登记的官方来源，与已保存的历史资料比较，列出价格、额度和商用授权的变化与前后证据。没有前期资料时明确说明无法做跨期判断。',
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
