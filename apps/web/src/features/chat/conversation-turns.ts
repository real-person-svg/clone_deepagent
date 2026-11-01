import type { ConversationDetail, RunEvent } from '../../../../../packages/contracts/index';
import { terminalStatuses } from '../../../../../packages/contracts/index';
import { statusText } from './chat.config';

export function conversationTurns(
  detail: ConversationDetail | null,
  events: Record<string, RunEvent[]>
) {
  const messages = detail?.messages || [];
  const turns = messages
    .filter((m) => m.role === 'user')
    .map((user) => {
      const assistant = messages.find((m) => m.runId === user.runId && m.role === 'assistant');
      const run = detail!.runs.find((r) => r.id === user.runId)!;
      const log = events[run.id] || [];
      const isActive = !terminalStatuses.includes(run.status);
      const step = Math.max(
        0,
        ...log.filter((e) => e.type === 'message.delta').map((e) => Number(e.data.step))
      );
      const streamed = log
        .filter((e) => e.type === 'message.delta' && Number(e.data.step) === step)
        .map((e) => e.data.text)
        .join('');
      const answer = assistant?.content || streamed;
      const showAnswer = Boolean(answer);
      const showThinking = !answer && isActive;
      const modeLabel = run.mode === 'multi' ? '多 Agent 协作' : '单 Agent · ReAct';
      const providerLabel = '真实模型';
      const agentName = run.snapshot[run.agentId || 'root']?.name || '研究 Agent';
      const traceFailed = ['failed', 'cancelled', 'partial'].includes(run.status);
      const thinkingLabel =
        run.mode === 'multi' ? '正在协调研究任务与来源证据' : '正在读取资料并执行工具';
      const statusLabel = statusText[run.status];
      const canExport = ['completed', 'partial'].includes(run.status);
      const reportUrl = `/api/reports/report_${run.id}/export`;

      return {
        user,
        run,
        log,
        isActive,
        answer,
        showAnswer,
        showThinking,
        modeLabel,
        providerLabel,
        agentName,
        traceFailed,
        thinkingLabel,
        statusLabel,
        reportUrl,
        canExport,
      };
    });

  return turns;
}
