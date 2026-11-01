import { BookOpenText, FolderOpen, Radio, Users } from 'lucide-react';
export const navigation = [
  { id: 'agents', icon: Users, label: '数字员工' },
  { id: 'sources', icon: FolderOpen, label: '来源资料' },
  { id: 'reports', icon: BookOpenText, label: '研究报告' },
  { id: 'subscriptions', icon: Radio, label: '任务与订阅' },
] as const;
