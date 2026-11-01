import Modal from '@douyinfe/semi-ui/lib/es/modal';
import { useWorkspace } from './useWorkspace';
export function WorkspaceDialogs({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const {
    title,
    deleting,
    settings,
    renameVisible,
    handleCancelRename,
    handleConfirmRename,
    handleTitleChange,
    deleteVisible,
    handleCancelDelete,
    deleteButtonProps,
    handleConfirmDelete,
    handleCloseSettings,
    conversationCount,
    reportCount,
    evidenceCount,
    modelLabel,
  } = workspace;

  return (
    <>
      {' '}
      <Modal
        title="重命名研究"
        visible={renameVisible}
        onCancel={handleCancelRename}
        onOk={handleConfirmRename}
      >
        <div className="form-stack">
          <label>
            研究标题
            <input value={title} onChange={handleTitleChange} maxLength={100} autoFocus />
          </label>
        </div>
      </Modal>
      <Modal
        title="删除这次研究？"
        visible={deleteVisible}
        onCancel={handleCancelDelete}
        okText="删除研究"
        okButtonProps={deleteButtonProps}
        onOk={handleConfirmDelete}
      >
        <p>将删除“{deleting?.title}”的消息、执行过程与报告。正在运行的任务需先停止。</p>
      </Modal>
      <Modal
        title="本地工作空间"
        visible={settings}
        onCancel={handleCloseSettings}
        footer={null}
        width={540}
      >
        <div className="form-stack">
          <div className="settings-statistics">
            <div>
              <strong>{conversationCount}</strong>
              <span>会话</span>
            </div>
            <div>
              <strong>{reportCount}</strong>
              <span>报告</span>
            </div>
            <div>
              <strong>{evidenceCount}</strong>
              <span>来源快照</span>
            </div>
          </div>
          <div className="settings-model">
            <strong>模型连接</strong>
            <span>{modelLabel}</span>
            <p>
              真实模型在服务端 .env 中配置
              MODEL_BASE_URL、MODEL_NAME、MODEL_API_KEY。密钥不会通过网页读取或保存。
            </p>
          </div>
          <p className="caption">
            此版本使用本机工作空间，服务监听 127.0.0.1。消息、报告、快照和任务均保存在
            data/workspace.sqlite。
          </p>
        </div>
      </Modal>
    </>
  );
}
