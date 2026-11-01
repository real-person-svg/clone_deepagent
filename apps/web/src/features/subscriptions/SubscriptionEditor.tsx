import Button from '@douyinfe/semi-ui/lib/es/button';
import Modal from '@douyinfe/semi-ui/lib/es/modal';
import { ShieldCheck } from 'lucide-react';
import { useSubscriptionPanel } from './useSubscriptionPanel';
export function SubscriptionEditor({
  subscriptions,
}: {
  subscriptions: ReturnType<typeof useSubscriptionPanel>;
}) {
  const {
    open,
    name,
    prompt,
    interval,
    threshold,
    busy,
    templateId,
    handleCloseCreate,
    createDisabled,
    handleCreateSubscription,
    handleTemplateChange,
    publishedTemplates,
    handleNameChange,
    handlePromptChange,
    handleIntervalChange,
    handleThresholdChange,
    baselineLabel,
  } = subscriptions;
  return (
    <Modal
      title="创建竞品巡检订阅"
      visible={open}
      onCancel={handleCloseCreate}
      width={600}
      footer={
        <div className="modal-actions">
          <Button onClick={handleCloseCreate}>取消</Button>
          <Button
            theme="solid"
            loading={busy}
            disabled={createDisabled}
            onClick={handleCreateSubscription}
          >
            创建并启用
          </Button>
        </div>
      }
    >
      <div className="form-stack">
        <p className="caption">
          使用虚构资料和已发布的 Agent 版本执行多 Agent
          研究。无变化时保持安静，异常或检查失败时写入站内通知。
        </p>
        <label>
          已发布任务模板
          <select value={templateId} onChange={handleTemplateChange}>
            {publishedTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} · v{template.publishedVersion}
              </option>
            ))}
          </select>
        </label>
        <label>
          订阅名称
          <input value={name} onChange={handleNameChange} maxLength={100} />
        </label>
        <label>
          研究任务
          <textarea value={prompt} onChange={handlePromptChange} rows={4} maxLength={4000} />
        </label>
        <div className="form-columns">
          <label>
            检查间隔
            <select value={interval} onChange={handleIntervalChange}>
              <option value={1440}>每天</option>
              <option value={60}>每小时</option>
              <option value={5}>每 5 分钟</option>
              <option value={1}>每分钟（验收用）</option>
            </select>
          </label>
          <label>
            价格变化阈值（%）
            <input
              type="number"
              min={0}
              max={1000}
              value={threshold}
              onChange={handleThresholdChange}
            />
          </label>
        </div>
        <div className="info-strip">
          <ShieldCheck size={15} />
          <span>
            基线使用当前{baselineLabel}
            快照。首次创建建立基线，不生成变化告警。
          </span>
        </div>
      </div>
    </Modal>
  );
}
