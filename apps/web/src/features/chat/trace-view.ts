import type { RunEvent } from '../../../../../packages/contracts/index';
import { agentNames, toolNames } from './trace.config';

const visibleEventTypes = [
  'agent.started',
  'tool.started',
  'agent.completed',
  'agent.failed',
  'run.recovered',
];

export function describeTrace(events: RunEvent[], active: boolean) {
  const tools = events.filter((event) => event.type === 'tool.started');
  const agents = events.filter((event) => event.type === 'agent.started');
  const end = events.at(-1)?.createdAt;
  let elapsed = 0;

  if (events.length && end) {
    const duration = new Date(end).getTime() - new Date(events[0].createdAt).getTime();
    elapsed = Math.max(0, Math.round(duration / 1000));
  }

  let summary = '正在研究';
  if (!active) {
    let agentCount = '';
    if (agents.length > 1) agentCount = ` · ${agents.length} 个 Agent`;
    summary = `${tools.length} 次工具调用${agentCount} · ${elapsed}s`;
  }

  const rows = events
    .filter((event) => visibleEventTypes.includes(event.type))
    .map((event) => {
      const isTool = event.type === 'tool.started';
      let completed: RunEvent | undefined;
      if (isTool) {
        completed = events.find(
          (candidate) =>
            candidate.type === 'tool.completed' &&
            candidate.data.callId === event.data.callId &&
            candidate.data.taskKey === event.data.taskKey
        );
      }

      const bad =
        (completed?.data.result as { ok?: boolean })?.ok === false || event.type === 'agent.failed';
      const toolName = String(event.data.name);
      const name = isTool
        ? toolNames[toolName] || toolName
        : agentNames[event.agent] || event.agent;
      let status: string;

      if (isTool) {
        if (completed) status = bad ? '未完成' : '已完成';
        else status = active ? '执行中' : '已中断';
      } else if (event.type === 'agent.started') status = `开始执行 · v${event.data.version}`;
      else if (event.type === 'agent.failed') status = '执行失败';
      else if (event.type === 'run.recovered') status = '恢复执行';
      else status = '已完成';

      return {
        event,
        isTool,
        completed,
        name,
        status,
        toolClassName: `tool-row ${bad ? 'bad' : ''}`,
        agentClassName: `agent-step ${event.type === 'agent.failed' ? 'bad' : ''}`,
        argumentsText: JSON.stringify(event.data.args, null, 2),
        resultText: JSON.stringify(completed?.data.result, null, 2),
      };
    });

  return { summary, rows };
}
