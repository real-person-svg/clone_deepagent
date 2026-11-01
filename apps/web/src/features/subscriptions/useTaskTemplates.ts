import Toast from '@douyinfe/semi-ui/lib/es/toast';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import type { TaskTemplate } from '../../../../../packages/contracts/index';
import { api } from '../../shared/api';

interface TemplateActions {
  prompt: string;
  setPrompt: Dispatch<SetStateAction<string>>;
  setName: Dispatch<SetStateAction<string>>;
  setOpen: Dispatch<SetStateAction<boolean>>;
}
export function useTaskTemplates({ prompt, setPrompt, setName, setOpen }: TemplateActions) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]),
    [templateId, setTemplateId] = useState('tpl_commercial'),
    [templateModal, setTemplateModal] = useState(false),
    [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null),
    [templateName, setTemplateName] = useState(''),
    [templatePrompt, setTemplatePrompt] = useState(''),
    [templateBusy, setTemplateBusy] = useState(false);

  const loadTemplates = () =>
    api<TaskTemplate[]>('/task-templates')
      .then(setTemplates)
      .catch((e) => Toast.error(e.message));

  const saveTemplate = async (publish: boolean) => {
    setTemplateBusy(true);
    try {
      const request: Record<string, unknown> = {};
      if (editingTemplate) {
        request.id = editingTemplate.id;
        request.revision = editingTemplate.draftRevision;
      }
      request.name = templateName.trim();
      request.prompt = templatePrompt.trim();
      request.publish = publish;

      await api('/task-templates', 'POST', request);
      await loadTemplates();
      setTemplateModal(false);
      Toast.success(publish ? '任务版本已发布，可以创建订阅' : '任务草稿已保存');
    } catch (e) {
      Toast.error((e as Error).message);
    } finally {
      setTemplateBusy(false);
    }
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplatePrompt(prompt);
    setTemplateModal(true);
  };

  const templateCards = templates.map((template) => {
    const versionLabel = template.publishedVersion
      ? `v${template.publishedVersion} · 已发布`
      : '草稿';
    const templateDescription = template.prompt || template.draftPrompt;

    const handleEditTemplate = () => {
      setEditingTemplate(template);
      setTemplateName(template.name);
      setTemplatePrompt(template.draftPrompt);
      setTemplateModal(true);
    };
    const subscribeDisabled = !template.publishedVersion;

    const handleSubscribeTemplate = () => {
      setTemplateId(template.id);
      setPrompt(template.prompt);
      setName(template.name);
      setOpen(true);
    };

    return {
      template,
      versionLabel,
      templateDescription,
      handleEditTemplate,
      subscribeDisabled,
      handleSubscribeTemplate,
    };
  });

  const templateEditorTitle = editingTemplate ? '编辑并发布任务模板' : '创建任务模板';

  const handleCloseTemplate = () => setTemplateModal(false);

  const draftDisabled = templateBusy || !templateName.trim() || !templatePrompt.trim();

  const handleSaveTemplateDraft = () => void saveTemplate(false);

  const publishDisabled = !templateName.trim() || !templatePrompt.trim();

  const handlePublishTemplate = () => void saveTemplate(true);

  const handleTemplateNameChange = (e: ChangeEvent<HTMLInputElement>) =>
    setTemplateName(e.target.value);

  const handleTemplatePromptChange = (e: ChangeEvent<HTMLTextAreaElement>) =>
    setTemplatePrompt(e.target.value);

  const handleTemplateChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setTemplateId(e.target.value);
    const template = templates.find((template) => template.id === e.target.value);
    if (template) {
      setPrompt(template.prompt);
      setName(template.name);
    }
  };

  const publishedTemplates = templates.filter((template) => template.publishedVersion);

  return {
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
  };
}
