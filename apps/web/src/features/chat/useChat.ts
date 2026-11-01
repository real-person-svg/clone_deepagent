import Toast from '@douyinfe/semi-ui/lib/es/toast';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Run } from '../../../../../packages/contracts/index';
import { api } from '../../shared/api';

import { prompts } from './chat.config';
import { conversationTurns } from './conversation-turns';
import { useConversationSession } from './useConversationSession';
export function useChat({
  conversationId,
  conversationTitle,
  onConversation,
  refresh,
  onEvidence,
  liveConfigured,
  onSettings,
}: {
  conversationId: string | null;
  conversationTitle?: string;
  onConversation: (id: string) => void;
  refresh: () => void;
  onEvidence: (id: string) => void;
  liveConfigured: boolean;

  onSettings: () => void;
}) {
  const {
    detail,
    input,
    setInput,
    agentId,
    setAgentId,
    events,
    loading,
    error,
    setError,
    attachment,
    setAttachment,
    viewport,
    stick,
    active,
    fetchDetail,
  } = useConversationSession(conversationId, refresh);
  const [busy, setBusy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = 'auto';
      textarea.current.style.height = Math.min(textarea.current.scrollHeight, 170) + 'px';
    }
  }, [input]);

  const submit = async (prompt = input) => {
    if (!prompt.trim() || active || busy || !liveConfigured) return;
    setBusy(true);
    setError('');
    try {
      let actual = prompt.trim();
      if (attachment) {
        const doc = await api<{ id: string }>('/documents', 'POST', {
          title: attachment.name,
          filename: attachment.name,
          competitor: '用户研究资料',
          content: attachment.content,
        });
        actual += `\n\n附加资料：${attachment.name}，证据 ID ${doc.id}，请通过 query_evidence 阅读相关内容。`;
      }
      const request: Record<string, unknown> = {};
      if (conversationId) request.conversationId = conversationId;
      request.prompt = actual;
      request.agentId = agentId;
      request.provider = 'live';

      const run = await api<Run>('/runs', 'POST', request);
      setInput('');
      setAttachment(null);
      stick.current = true;
      if (run.conversationId !== conversationId) onConversation(run.conversationId);
      else await fetchDetail(run.conversationId);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const attach = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 500000) {
      Toast.error('文本资料请控制在 500KB 内');

      return;
    }
    if (!/\.(txt|md|csv|json)$/i.test(file.name)) {
      Toast.error('支持 TXT、Markdown、CSV 和 JSON 文本资料');

      return;
    }
    setAttachment({ name: file.name, content: await file.text() });
  };

  const messages = detail?.messages || [];
  const turns = conversationTurns(detail, events);
  const showLoading = loading;
  const showConversation = !loading && messages.length > 0;
  const showWelcome = !loading && !messages.length;
  const chatTitle = conversationTitle || detail?.title || 'Agent 对话';
  const selectorDisabled = Boolean(active) || busy || loading;

  const handleScroll = () => {
    const v = viewport.current!;
    stick.current = v.scrollHeight - v.scrollTop - v.clientHeight < 140;
  };

  const suggestions = prompts.map((p) => {
    const handleSelectPrompt = () => {
      setInput(p.text);
      textarea.current?.focus();
    };

    return { p, handleSelectPrompt };
  });

  const handleDismissError = () => setError('');

  const handleRemoveAttachment = () => setAttachment(null);

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value);

  const handleInputKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  const inputPlaceholder = active
    ? 'Agent 正在研究，你可以停止当前任务'
    : '描述你要处理的研究任务…';

  const handleChooseFile = () => fileInput.current?.click();

  const isRunning = Boolean(active);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    void attach(e.target.files?.[0]);
    e.target.value = '';
  };

  const composerProviderLabel = liveConfigured ? '真实模型' : '模型未配置';
  const handleCancelRun = async () => {
    if (!active) return;
    await api(`/runs/${active.id}/cancel`, 'POST');
    await fetchDetail(conversationId!);
  };

  const sendDisabled = !input.trim() || busy || !liveConfigured;

  const handleSend = () => void submit();

  return {
    showLoading,
    showConversation,
    showWelcome,
    detail,
    input,
    agentId,
    setAgentId,
    events,
    busy,
    loading,
    error,
    attachment,
    viewport,
    textarea,
    fileInput,
    active,
    messages,
    chatTitle,
    selectorDisabled,
    handleScroll,
    turns,
    suggestions,
    handleDismissError,
    handleRemoveAttachment,
    handleInputChange,
    handleInputKeyDown,
    inputPlaceholder,
    handleChooseFile,
    isRunning,
    handleFileChange,
    composerProviderLabel,
    handleCancelRun,
    sendDisabled,
    handleSend,
  };
}
