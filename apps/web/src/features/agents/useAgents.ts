import Toast from '@douyinfe/semi-ui/lib/es/toast';
import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import type { AgentSummary } from '../../../../../packages/contracts/index';
import { api } from '../../shared/api';
import { toolLabels } from './agent.config';

export function useAgents({ onRefresh }: { onRefresh: () => void }) {
  const [agents, setAgents] = useState<AgentSummary[]>([]),
    [editing, setEditing] = useState<AgentSummary | null>(null),
    [prompt, setPrompt] = useState(''),
    [saving, setSaving] = useState(false);

  const load = () =>
    api<AgentSummary[]>('/agents')
      .then(setAgents)
      .catch((e) => Toast.error(e.message));

  useEffect(() => {
    void load();
  }, []);

  const save = async (publish: boolean) => {
    if (!editing) return;
    setSaving(true);
    try {
      await api(`/agents/${editing.id}${publish ? '/publish' : ''}`, publish ? 'POST' : 'PATCH', {
        systemPrompt: prompt,
        revision: editing.draftRevision,
      });
      Toast.success(publish ? '新版本已发布，新任务将使用此版本' : '草稿已保存');
      setEditing(null);
      await load();
      onRefresh();
    } catch (e) {
      Toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const agentCards = agents.map((a) => {
    const cardClassName = `agent-card ${a.id === 'root' ? 'root-agent' : ''}`;
    const avatar = a.name.slice(0, 1);
    const toolChips = a.tools.map((t) => {
      const toolLabel = toolLabels[t];

      return { t, toolLabel };
    });

    const handleEdit = () => {
      setEditing(a);
      setPrompt(a.draft.systemPrompt);
    };

    return { a, cardClassName, avatar, toolChips, handleEdit };
  });

  const editorTitle = editing ? `${editing.name} · 配置` : '';
  const editorVisible = Boolean(editing);

  const handleCloseEditor = () => setEditing(null);

  const handleSaveDraft = () => void save(false);

  const handlePublish = () => void save(true);

  const handlePromptChange = (e: ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value);

  return {
    agents,
    editing,
    prompt,
    saving,
    agentCards,
    editorTitle,
    editorVisible,
    handleCloseEditor,
    handleSaveDraft,
    handlePublish,
    handlePromptChange,
  };
}
