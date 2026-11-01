import { Store } from '../../storage/index';
import { evidenceTerms } from '../evidence/search';
import { object, string, type Spec } from '../tools/types';
export function createHistoryTools(store: Store): Record<string, Spec> {
  return {
    search_history: {
      description:
        '读取当前会话之前的完整消息，恢复用户约束或旧报告内容。多个关键词空格分开，任一命中均返回；空query读取最近历史，offset每页加8可继续向前。按时间倒序，最新用户更正优先于旧报告。',
      schema: object({ query: string, offset: { type: 'integer', minimum: 0, maximum: 100000 } }),
      execute: (args, c) => {
        const terms = evidenceTerms(String(args.query || ''));
        const found = store
          .all<{
            role: string;
            content: string;
            createdAt: string;
          }>(
            'SELECT role,content,createdAt FROM messages WHERE conversationId=? AND runId!=? ORDER BY createdAt DESC,rowid DESC',
            c.conversationId,
            c.runId
          )
          .filter(
            (m) =>
              !terms.length || terms.some((term) => m.content.toLocaleLowerCase().includes(term))
          );
        const offset = Number(args.offset || 0);

        return {
          messages: found.slice(offset, offset + 8),
          total: found.length,
          nextOffset: offset + 8 < found.length ? offset + 8 : null,
          order: 'newest_first',
        };
      },
    },
  };
}
