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
  dataset,
  onSettings,
}: {
  conversationId: string | null;
  conversationTitle?: string;
  onConversation: (id: string) => void;
  refresh: () => void;
  onEvidence: (id: string) => void;
  liveConfigured: boolean;
  dataset: string;
  onSettings: () => void;
}) {
  const {
    detail,
    input,
    setInput,
    mode,
    setMode,
    provider,
    setProvider,
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
  const [menu, setMenu] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = 'auto';
      textarea.current.style.height = Math.min(textarea.current.scrollHeight, 170) + 'px';
    }
  }, [input]);

  const submit = async (prompt = input, pickedMode = mode) => {
    if (!prompt.trim() || active || busy) return;
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
      request.mode = pickedMode;
      request.provider = provider;

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
  const selectorCompact = Boolean(detail);
  const selectorDisabled = Boolean(active) || busy;

  const handleScroll = () => {
    const v = viewport.current!;
    stick.current = v.scrollHeight - v.scrollTop - v.clientHeight < 140;
  };

  const suggestions = prompts.map((p) => {
    const handleSelectPrompt = () => {
      setInput(p.text);
      setMode(p.mode);
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

  const handleToggleMode = () => setMode(mode === 'single' ? 'multi' : 'single');

  const composerModeLabel = mode === 'multi' ? '多 Agent' : '单 Agent';

  const handleToggleProviderMenu = () => setMenu(!menu);

  const composerProviderLabel = provider === 'demo' ? '离线演示' : '真实模型';

  const handleCloseProviderMenu = () => setMenu(false);

  const handleSelectDemo = () => {
    setProvider('demo');
    setMenu(false);
  };

  const liveProviderDisabled = !liveConfigured;

  const handleSelectLive = () => {
    setProvider('live');
    setMenu(false);
  };

  const liveProviderDescription = liveConfigured
    ? '使用服务端模型和已导入来源'
    : '请在服务端 .env 配置模型';

  const handleCancelRun = async () => {
    if (!active) return;
    await api(`/runs/${active.id}/cancel`, 'POST');
    await fetchDetail(conversationId!);
  };

  const sendDisabled = !input.trim() || busy;

  const handleSend = () => void submit();

  const providerCaption =
    provider === 'demo' ? '离线演示使用虚构竞品资料' : '结论请结合来源原文核对';

  return {
    showLoading,
    showConversation,
    showWelcome,
    detail,
    input,
    mode,
    setMode,
    provider,
    events,
    busy,
    loading,
    error,
    menu,
    attachment,
    viewport,
    textarea,
    fileInput,
    active,
    messages,
    chatTitle,
    selectorCompact,
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
    handleToggleMode,
    composerModeLabel,
    handleToggleProviderMenu,
    composerProviderLabel,
    handleCloseProviderMenu,
    handleSelectDemo,
    liveProviderDisabled,
    handleSelectLive,
    liveProviderDescription,
    handleCancelRun,
    sendDisabled,
    handleSend,
    providerCaption,
  };
}
