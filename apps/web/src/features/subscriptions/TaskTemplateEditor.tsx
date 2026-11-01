import Button from '@douyinfe/semi-ui/lib/es/button';
import Modal from '@douyinfe/semi-ui/lib/es/modal';
import { useSubscriptionPanel } from './useSubscriptionPanel';
export function TaskTemplateEditor({
  subscriptions,
}: {
  subscriptions: ReturnType<typeof useSubscriptionPanel>;
}) {
  const {
    templateModal,
    templateName,
    templatePrompt,
    templateBusy,
    templateEditorTitle,
    handleCloseTemplate,
    draftDisabled,
    handleSaveTemplateDraft,
    publishDisabled,
    handlePublishTemplate,
    handleTemplateNameChange,
    handleTemplatePromptChange,
  } = subscriptions;
  return (
    <Modal
      title={templateEditorTitle}
      visible={templateModal}
      onCancel={handleCloseTemplate}
      width={620}
      footer={
        <div className="modal-actions">
          <Button onClick={handleCloseTemplate}>取消</Button>
          <Button disabled={draftDisabled} onClick={handleSaveTemplateDraft}>
            保存草稿
          </Button>
          <Button
            theme="solid"
            loading={templateBusy}
            disabled={publishDisabled}
            onClick={handlePublishTemplate}
          >
            发布任务版本
          </Button>
        </div>
      }
    >
      <div className="form-stack">
        <p className="caption">
          发布时固定研究要求和当前 Agent
          版本。已有订阅继续使用它们绑定的模板版本，新订阅可使用新版本。
        </p>
        <label>
          任务模板名称
          <input value={templateName} onChange={handleTemplateNameChange} maxLength={100} />
        </label>
        <label>
          任务要求
          <textarea
            value={templatePrompt}
            onChange={handleTemplatePromptChange}
            rows={7}
            maxLength={4000}
          />
        </label>
      </div>
    </Modal>
  );
}
