import Toast from '@douyinfe/semi-ui/lib/es/toast';
import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import type { Evidence } from '../../../../../packages/contracts/index';
import { api } from '../../shared/api';
import { localTime } from '../../shared/format';

import { sourceKindLabels } from './source.config';

export function useSources({ onEvidence }: { onEvidence: (id: string) => void }) {
  const [sources, setSources] = useState<Evidence[]>([]),
    [filter, setFilter] = useState(''),
    [open, setOpen] = useState(false),
    [tab, setTab] = useState<'upload' | 'web'>('upload'),
    [title, setTitle] = useState(''),
    [competitor, setCompetitor] = useState(''),
    [content, setContent] = useState(''),
    [url, setUrl] = useState(''),
    [busy, setBusy] = useState(false);

  const load = () =>
    api<Evidence[]>('/evidence')
      .then(setSources)
      .catch((e) => Toast.error(e.message));

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!competitor.trim() || (tab === 'upload' ? !title.trim() || !content.trim() : !url.trim()))
      return;
    setBusy(true);
    try {
      if (tab === 'upload')
        await api('/documents', 'POST', {
          title: title.trim(),
          competitor: competitor.trim(),
          content,
        });
      else await api('/sources', 'POST', { competitor: competitor.trim(), url: url.trim() });
      await load();
      setOpen(false);
      setTitle('');
      setCompetitor('');
      setContent('');
      setUrl('');
      Toast.success('资料已保存到 SQLite，可在研究中引用');
    } catch (e) {
      Toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const items = sources.filter(
    (source) =>
      !filter ||
      [source.title, source.competitor, source.content]
        .join(' ')
        .toLowerCase()
        .includes(filter.toLowerCase())
  );

  const handleOpenImport = () => setOpen(true);

  const handleFilterChange = (e: ChangeEvent<HTMLInputElement>) => setFilter(e.target.value);

  const sourceCards = items.map((source) => {
    const handleOpenEvidence = () => onEvidence(source.id);
    const kindClassName = `source-kind ${source.kind}`;
    const kindLabel = sourceKindLabels[source.kind] || '公开网页';
    const observedAt = localTime(source.observedAt, true);

    return { source, handleOpenEvidence, kindClassName, kindLabel, observedAt };
  });

  const handleCloseImport = () => setOpen(false);

  const saveDisabled =
    !competitor.trim() || (tab === 'upload' ? !title.trim() || !content.trim() : !url.trim());

  const handleSaveSource = () => void save();

  const saveLabel = tab === 'upload' ? '保存资料' : '采集并保存';
  const uploadTabClassName = tab === 'upload' ? 'selected' : '';

  const handleSelectUpload = () => setTab('upload');

  const webTabClassName = tab === 'web' ? 'selected' : '';

  const handleSelectWeb = () => setTab('web');

  const handleCompetitorChange = (e: ChangeEvent<HTMLInputElement>) =>
    setCompetitor(e.target.value);

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value);

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value);

  const handleUrlChange = (e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value);

  return {
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
  };
}
