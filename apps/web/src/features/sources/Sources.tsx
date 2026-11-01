import Button from '@douyinfe/semi-ui/lib/es/button';
import Modal from '@douyinfe/semi-ui/lib/es/modal';
import { ArrowUpRight, FileText, Globe2, Plus, Upload } from 'lucide-react';
import { useSources } from './useSources';
export function Sources(props: Parameters<typeof useSources>[0]) {
  const {
    filter,
    open,
    tab,
    title,
    competitor,
    content,
    url,
    busy,
    items,
    handleOpenImport,
    handleFilterChange,
    sourceCards,
    handleCloseImport,
    saveDisabled,
    handleSaveSource,
    saveLabel,
    uploadTabClassName,
    handleSelectUpload,
    webTabClassName,
    handleSelectWeb,
    handleCompetitorChange,
    handleTitleChange,
    handleContentChange,
    handleUrlChange,
  } = useSources(props);

  return (
    <section className="management-page">
      <div className="management-heading">
        <div>
          <span className="eyebrow">EVIDENCE LIBRARY</span>
          <h1>来源资料</h1>
          <p>原始资料、不可变快照，以及每个结论的依据。</p>
        </div>
        <Button theme="solid" icon={<Plus size={15} />} onClick={handleOpenImport}>
          添加资料
        </Button>
      </div>
      <div className="info-strip">
        <Globe2 size={16} />
        <span>
          导入真实产品资料或采集官方公开页面。来源为空时，请先添加资料；未披露的信息会标为未知。
        </span>
      </div>
      <div className="source-toolbar">
        <div className="filter-input">
          <input
            placeholder="搜索产品、标题或原文"
            value={filter}
            onChange={handleFilterChange}
            aria-label="搜索来源资料"
          />
        </div>
        <span>{items.length} 份资料</span>
      </div>
      <div className="source-list">
        {sourceCards.map(({ source, handleOpenEvidence, kindClassName, kindLabel, observedAt }) => (
          <button className="source-item" key={source.id} onClick={handleOpenEvidence}>
            <span className={kindClassName}>
              <FileText size={16} />
            </span>
            <div>
              <h2>{source.title}</h2>
              <p>
                {source.competitor} · {kindLabel} · {observedAt}
              </p>
            </div>
            <ArrowUpRight size={15} />
          </button>
        ))}
      </div>
      <Modal
        title="添加研究资料"
        visible={open}
        onCancel={handleCloseImport}
        width={620}
        footer={
          <div className="modal-actions">
            <Button onClick={handleCloseImport}>取消</Button>
            <Button theme="solid" loading={busy} disabled={saveDisabled} onClick={handleSaveSource}>
              {saveLabel}
            </Button>
          </div>
        }
      >
        <div className="form-stack">
          <div className="segmented">
            <button className={uploadTabClassName} onClick={handleSelectUpload}>
              <Upload size={14} />
              导入文本
            </button>
            <button className={webTabClassName} onClick={handleSelectWeb}>
              <Globe2 size={14} />
              公开网页
            </button>
          </div>
          <label>
            产品 / 资料归属
            <input
              value={competitor}
              onChange={handleCompetitorChange}
              placeholder="例如：我方产品，或某个竞品名称"
              maxLength={100}
            />
          </label>
          {tab === 'upload' ? (
            <>
              <label>
                资料标题
                <input
                  value={title}
                  onChange={handleTitleChange}
                  placeholder="例如：产品介绍与套餐说明"
                  maxLength={200}
                />
              </label>
              <label>
                原始内容
                <textarea
                  value={content}
                  onChange={handleContentChange}
                  rows={9}
                  placeholder="粘贴资料原文，也可在对话框上传文本文件"
                  maxLength={200000}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                公开页面 URL
                <input
                  type="url"
                  value={url}
                  onChange={handleUrlChange}
                  placeholder="https://example.com/pricing"
                  maxLength={2000}
                />
              </label>
              <p className="caption">
                支持公开静态 HTML/文本。需要登录、动态交互或被阻止的页面，可通过文本导入补充。
              </p>
            </>
          )}
        </div>
      </Modal>
    </section>
  );
}
