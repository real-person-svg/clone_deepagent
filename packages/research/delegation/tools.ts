import { AppError, Store } from '../../storage/index';
import { object, type Spec } from '../tools/types';
export function createDelegationTools(store: Store): Record<string, Spec> {
  return {
    delegate_tasks: {
      description: '仅供研究主 Agent 使用。分阶段委派业务子任务；不依赖的任务可放在同一批次。',
      schema: object(
        {
          tasks: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: object(
              {
                agent: { enum: ['research', 'pricing', 'product', 'strategy', 'verifier'] },
                goal: { type: 'string', minLength: 1, maxLength: 8000 },
              },
              ['agent', 'goal']
            ),
          },
        },
        ['tasks']
      ),
      execute: async (args, c) => {
        if (!c.delegate) throw new AppError(403, '当前执行不允许委派子任务');

        return c.delegate(args.tasks as { agent: string; goal: string }[]);
      },
    },
  };
}
