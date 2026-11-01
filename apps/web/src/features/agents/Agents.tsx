import Button from '@douyinfe/semi-ui/lib/es/button';
import Modal from '@douyinfe/semi-ui/lib/es/modal';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { useAgents } from './useAgents';
export function Agents(props: Parameters<typeof useAgents>[0]) {
  const {
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
  } = useAgents(props);

  return (
    <section className="management-page">
      <div className="management-heading">
        <div>
          <span className="eyebrow">AGENT LIBRARY</span>
          <h1>数字员工</h1>
          <p>专业分工，共同完成有证据的商业化研究。</p>
        </div>
        <span className="subtle-badge">
          <i />
          {agents.length} 个已发布 Agent
        </span>
      </div>
      <div className="info-strip">
        <ShieldCheck size={16} />
        <span>每次研究固定 Agent 版本快照。新发布版本不会改变正在执行的任务。</span>
      </div>
      <div className="agent-grid">
        {agentCards.map(({ a, cardClassName, avatar, toolChips, handleEdit }) => (
          <article className={cardClassName} key={a.id}>
            <div className="agent-card-top">
              <span className="agent-mark">{avatar}</span>
              <span className="version-tag">v{a.version} · 已发布</span>
            </div>
            <h2>{a.name}</h2>
            <p>{a.description}</p>
            <div className="tool-chips">
              {toolChips.map(({ t, toolLabel }) => (
                <span key={t}>{toolLabel}</span>
              ))}
            </div>
            <div className="agent-card-bottom">
              <span>{a.maxSteps} 步执行上限</span>
              <button onClick={handleEdit}>
                配置与发布
                <ArrowUpRight size={13} />
              </button>
            </div>
          </article>
        ))}
      </div>
      <Modal
        title={editorTitle}
        visible={editorVisible}
        onCancel={handleCloseEditor}
        footer={
          <div className="modal-actions">
            <Button onClick={handleCloseEditor}>取消</Button>
            <Button disabled={saving} onClick={handleSaveDraft}>
              保存草稿
            </Button>
            <Button theme="solid" type="primary" loading={saving} onClick={handlePublish}>
              发布新版本
            </Button>
          </div>
        }
        width={720}
      >
        <div className="form-stack">
          <p className="caption">
            修改职责与输出要求。工具权限由服务端维护；历史版本和正在运行的任务保持原快照。
          </p>
          <label>
            系统提示词
            <textarea
              className="prompt-editor"
              value={prompt}
              onChange={handlePromptChange}
              rows={14}
              maxLength={24000}
            />
          </label>
          <div className="form-hint">
            当前版本 v{editing?.version} · 草稿修订 {editing?.draftRevision}
          </div>
        </div>
      </Modal>
    </section>
  );
}
