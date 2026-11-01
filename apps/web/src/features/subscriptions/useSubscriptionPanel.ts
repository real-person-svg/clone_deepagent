import Toast from '@douyinfe/semi-ui/lib/es/toast';
import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import type { Evidence, Run, Subscription } from '../../../../../packages/contracts/index';
import { api } from '../../shared/api';
import { localTime } from '../../shared/format';

import { useTaskTemplates } from './useTaskTemplates';
export function useSubscriptionPanel({
  onConversation,
  refresh,
}: {
  onConversation: (id: string) => void;
  refresh: () => void;
}) {
  const [items, setItems] = useState<Subscription[]>([]),
    [open, setOpen] = useState(false),
    [name, setName] = useState('AI 竞品商业化巡检'),
    [prompt, setPrompt] = useState(
      '刷新选定的官方来源，核对价格、套餐权益和商用授权的变化，提供前后原文证据。'
    ),
    [interval, setIntervalValue] = useState(1440),
    [sourceIds, setSourceIds] = useState<string[]>([]),
    [sources, setSources] = useState<Evidence[]>([]),
    [busy, setBusy] = useState(false),
    [checking, setChecking] = useState('');

  const templates = useTaskTemplates({ prompt, setPrompt, setName, setOpen });
  const {
    templateId,
    loadTemplates,
    handleNewTemplate,
    templateCards,
    templateEditorTitle,
    handleCloseTemplate,
    draftDisabled,
    handleSaveTemplateDraft,
    publishDisabled,
    handlePublishTemplate,
    handleTemplateNameChange,
    handleTemplatePromptChange,
    handleTemplateChange,
    publishedTemplates,
    templateModal,
    templateName,
    templatePrompt,
    templateBusy,
  } = templates;

  const load = () =>
    api<Subscription[]>('/subscriptions')
      .then(setItems)
      .catch((e) => Toast.error(e.message));

  useEffect(() => {
    void load();
    void loadTemplates();
    api<Evidence[]>('/evidence')
      .then((items) => {
        const seen = new Set<string>();
        setSources(
          items.filter((s) => {
            if (s.kind !== 'web') return false;
            const key = JSON.stringify([s.competitor, s.url]);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
        );
      })
      .catch((e) => Toast.error(e.message));
    const timer = setInterval(() => void load(), 4000);

    return () => clearInterval(timer);
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      await api('/subscriptions', 'POST', {
        name,
        prompt,
        intervalMinutes: interval,
        sourceIds,
        templateId,
      });
      setOpen(false);
      await load();
      Toast.success('订阅已创建，所选来源作为变化基线');
    } catch (e) {
      Toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleOpenCreate = () => setOpen(true);

  const subscriptionCards = items.map((subscription) => {
    const statusClassName = `status-dot ${subscription.enabled ? 'on' : ''}`;
    const enabledLabel = subscription.enabled ? '已启用' : '已暂停';
    const intervalLabel =
      subscription.intervalMinutes >= 1440
        ? `每 ${subscription.intervalMinutes / 1440} 天`
        : `每 ${subscription.intervalMinutes} 分钟`;
    const templateVersion = subscription.templateVersion || 1;
    const scheduleLabel = subscription.lastRunAt
      ? `最近检查 ${localTime(subscription.lastRunAt, true)}`
      : `下次 ${localTime(subscription.nextFireAt, true)}（北京时间）`;

    const handleToggleSubscription = async () => {
      try {
        await api(`/subscriptions/${subscription.id}`, 'PATCH', {
          enabled: !subscription.enabled,
          revision: subscription.revision,
        });
        await load();
      } catch (e) {
        Toast.error((e as Error).message);
      }
    };
    const toggleLabel = subscription.enabled ? '暂停' : '启用';
    const checkDisabled = !subscription.enabled || checking === subscription.id;

    const handleCheckNow = async () => {
      setChecking(subscription.id);
      try {
        const r = await api<Run>(`/subscriptions/${subscription.id}/check`, 'POST', {
          key: crypto.randomUUID(),
        });
        refresh();
        onConversation(r.conversationId);
      } catch (e) {
        Toast.error((e as Error).message);
      } finally {
        setChecking('');
      }
    };

    return {
      subscription,
      statusClassName,
      enabledLabel,
      intervalLabel,
      templateVersion,
      scheduleLabel,
      handleToggleSubscription,
      toggleLabel,
      checkDisabled,
      handleCheckNow,
    };
  });

  const handleCloseCreate = () => setOpen(false);

  const createDisabled =
    !name.trim() || !prompt.trim() || !sourceIds.length || sourceIds.length > 10;

  const handleCreateSubscription = () => void create();

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => setName(e.target.value);

  const handlePromptChange = (e: ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value);

  const handleIntervalChange = (e: ChangeEvent<HTMLSelectElement>) =>
    setIntervalValue(Number(e.target.value));

  const handleSourceChange = (id: string, selected: boolean) =>
    setSourceIds((ids) => (selected ? [...ids, id] : ids.filter((item) => item !== id)));

  return {
    items,
    open,
    name,
    prompt,
    interval,
    sources,
    sourceIds,
    handleSourceChange,
    busy,
    checking,
    templateId,
    templateModal,
    templateName,
    templatePrompt,
    templateBusy,
    handleOpenCreate,
    handleNewTemplate,
    templateCards,
    subscriptionCards,
    templateEditorTitle,
    handleCloseTemplate,
    draftDisabled,
    handleSaveTemplateDraft,
    publishDisabled,
    handlePublishTemplate,
    handleTemplateNameChange,
    handleTemplatePromptChange,
    handleCloseCreate,
    createDisabled,
    handleCreateSubscription,
    handleTemplateChange,
    publishedTemplates,
    handleNameChange,
    handlePromptChange,
    handleIntervalChange,
  };
}
