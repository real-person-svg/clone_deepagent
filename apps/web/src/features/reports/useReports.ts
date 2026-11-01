import Toast from '@douyinfe/semi-ui/lib/es/toast';
import { useEffect, useState } from 'react';
import type { Report } from '../../../../../packages/contracts/index';
import { api } from '../../shared/api';
import { localTime } from '../../shared/format';

export function useReports(onConversation: (id: string) => void) {
  const [reports, setReports] = useState<Report[]>([]),
    [selected, setSelected] = useState<Report | null>(null);

  useEffect(() => {
    api<Report[]>('/reports')
      .then(setReports)
      .catch((e) => Toast.error(e.message));
  }, []);

  const handleBack = () => setSelected(null);

  const handleConversation = () => {
    if (selected) onConversation(selected.conversationId);
  };
  const reportCards = reports.map((report) => ({
    report,
    handleSelect: () => setSelected(report),
    observedAt: localTime(report.createdAt, true),
    datasetLabel: report.dataset === 'baseline' ? '基准快照' : '变化快照',
  }));
  const exportUrl = selected ? `/api/reports/${selected.id}/export` : '';
  const selectedTime = selected ? localTime(selected.createdAt, true) : '';

  return {
    reports,
    selected,
    reportCards,
    exportUrl,
    selectedTime,
    handleBack,
    handleConversation,
  };
}
