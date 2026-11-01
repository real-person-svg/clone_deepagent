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
    sources,
    sourceIds,
    handleSourceChange,
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
          定期重新采集选定的公开页面，使用服务端真实模型分析。来源内容更新或检查未完成时写入站内通知，无变化时保持安静。每次研究会消耗模型额度。
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
            </select>
          </label>
        </div>
        <fieldset className="form-stack">
          <legend>监控来源（1 至 10 个公开页面）</legend>
          {!sources.length && (
            <p className="caption">请先在“来源资料”采集官方公开页面，再创建订阅。</p>
          )}
          {sources.map((source) => (
            <label key={source.id}>
              <input
                type="checkbox"
                checked={sourceIds.includes(source.id)}
                onChange={(event) => handleSourceChange(source.id, event.target.checked)}
              />
              {source.competitor} · {source.title}
            </label>
          ))}
        </fieldset>
        <div className="info-strip">
          <ShieldCheck size={15} />
          <span>
            所选来源的当前原文作为基线。内容更新仅表示原文变化，是否影响价格或授权需结合报告核对。
          </span>
        </div>
      </div>
    </Modal>
  );
}
