import Button from '@douyinfe/semi-ui/lib/es/button';
import { Clock3, LoaderCircle, Pause, Play, Plus, Radio } from 'lucide-react';
import { Empty } from '../../shared/Empty';
import { SubscriptionEditor } from './SubscriptionEditor';
import { TaskTemplateEditor } from './TaskTemplateEditor';
import { TaskTemplateLibrary } from './TaskTemplateLibrary';
import { useSubscriptionPanel } from './useSubscriptionPanel';
export function SubscriptionPanel(props: Parameters<typeof useSubscriptionPanel>[0]) {
  const subscriptions = useSubscriptionPanel(props);
  const { items, checking, handleOpenCreate, subscriptionCards } = subscriptions;

  return (
    <section className="management-page">
      <div className="management-heading">
        <div>
          <span className="eyebrow">RESEARCH ON AUTOPILOT</span>
          <h1>任务与订阅</h1>
          <p>把一次研究变成持续观察，有变化时再通知你。</p>
        </div>
        <Button theme="solid" icon={<Plus size={15} />} onClick={handleOpenCreate}>
          创建订阅
        </Button>
      </div>
      <div className="subscription-guide">
        <span className="guide-icon">
          <Radio size={20} />
        </span>
        <div>
          <strong>持续核对真实来源</strong>
          <p>
            选择已采集的官方页面建立基线。服务运行时定期刷新页面并分析，保留前后证据；采集失败或研究不完整时保留旧基线。
          </p>
        </div>
      </div>
      <TaskTemplateLibrary subscriptions={subscriptions} />
      <div className="template-heading">
        <h2>我的订阅</h2>
        <span>{items.length} 个</span>
      </div>

      {!items.length && (
        <Empty
          icon={Radio}
          title="让 Agent 持续关注重要变化"
          description="选择真实来源，定期检查内容更新并生成有证据的研究报告。"
        />
      )}
      {items.length > 0 && (
        <div className="subscription-list">
          {subscriptionCards.map(
            ({
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
            }) => (
              <article className="subscription-card" key={subscription.id}>
                <div className="subscription-card-heading">
                  <span className={statusClassName} />
                  <h2>{subscription.name}</h2>
                  <span className="subtle-tag">{enabledLabel}</span>
                </div>
                <p>{subscription.prompt}</p>
                <div className="subscription-facts">
                  <span>
                    <Clock3 size={13} />
                    {intervalLabel}
                  </span>
                  <span>{subscription.sourceIds.length} 个公开来源</span>
                  <span>来源更新时通知</span>
                  <span>真实来源巡检 · 模板 v{templateVersion}</span>
                </div>
                <div className="subscription-card-footer">
                  <span>{scheduleLabel}</span>
                  <div>
                    <button className="text-button" onClick={handleToggleSubscription}>
                      {subscription.enabled ? <Pause size={13} /> : <Play size={13} />}
                      {toggleLabel}
                    </button>
                    <button
                      className="button-secondary"
                      disabled={checkDisabled}
                      onClick={handleCheckNow}
                    >
                      {checking === subscription.id ? (
                        <LoaderCircle size={13} className="spin" />
                      ) : (
                        <Play size={13} />
                      )}
                      立即检查
                    </button>
                  </div>
                </div>
              </article>
            )
          )}
        </div>
      )}

      <TaskTemplateEditor subscriptions={subscriptions} />
      <SubscriptionEditor subscriptions={subscriptions} />
    </section>
  );
}
