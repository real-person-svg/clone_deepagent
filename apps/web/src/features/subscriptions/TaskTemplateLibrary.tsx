import { ArrowUpRight, FileText, Plus } from 'lucide-react';
import { useSubscriptionPanel } from './useSubscriptionPanel';
export function TaskTemplateLibrary({
  subscriptions,
}: {
  subscriptions: ReturnType<typeof useSubscriptionPanel>;
}) {
  const { handleNewTemplate, templateCards } = subscriptions;

  return (
    <div className="template-section">
      <div className="template-heading">
        <h2>可订阅任务模板</h2>
        <button className="text-button" onClick={handleNewTemplate}>
          <Plus size={13} />
          新建模板
        </button>
      </div>
      <div className="template-grid">
        {templateCards.map(
          ({
            template,
            versionLabel,
            templateDescription,
            handleEditTemplate,
            subscribeDisabled,
            handleSubscribeTemplate,
          }) => (
            <article className="template-card" key={template.id}>
              <div>
                <FileText size={16} />
                <strong>{template.name}</strong>
                <span className="version-tag">{versionLabel}</span>
              </div>
              <p>{templateDescription}</p>
              <footer>
                <button className="text-button" onClick={handleEditTemplate}>
                  编辑与发布
                  <ArrowUpRight size={12} />
                </button>
                <button
                  className="text-button"
                  disabled={subscribeDisabled}
                  onClick={handleSubscribeTemplate}
                >
                  订阅此任务
                  <Plus size={12} />
                </button>
              </footer>
            </article>
          )
        )}
      </div>
    </div>
  );
}
