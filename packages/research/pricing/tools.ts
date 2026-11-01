import type { PricePlan } from '../../contracts/index';
import { Store } from '../../storage/index';
import { commercialFacts, compareFacts, normalizePricing } from '../pricing';
import { validatePriceQuote } from '../pricing/quote';
import { object, string, type Spec } from '../tools/types';
export function createPricingTools(store: Store): Record<string, Spec> {
  return {
    normalize_pricing: {
      description:
        '确定性计算月均成本、12个月支出与最低席位条件。真实资料的plans必须附evidenceId与逐字sourceQuote（400字内，含金额及明确付款周期）；周期未知不得推定。席位数是场景假设，不证明团队授权。',
      schema: object({
        teamSize: { type: 'integer', minimum: 1, maximum: 10000 },
        plans: {
          type: 'array',
          maxItems: 20,
          items: object(
            {
              competitor: string,
              plan: string,
              amount: { type: 'string', pattern: '^\\d+(\\.\\d{1,4})?$' },
              currency: { type: 'string', pattern: '^[A-Z]{3}$' },
              billingPeriod: { enum: ['month', 'year'] },
              unit: { enum: ['seat', 'team'] },
              minimumSeats: { type: 'integer', minimum: 1, maximum: 10000 },
              quota: string,
              commercialRights: string,
              api: string,
              evidenceId: string,
              sourceQuote: { type: 'string', minLength: 1, maxLength: 400 },
            },
            [
              'competitor',
              'plan',
              'amount',
              'currency',
              'billingPeriod',
              'unit',
              'minimumSeats',
              'quota',
              'commercialRights',
              'api',
              'evidenceId',
            ]
          ),
        },
      }),
      execute: (args, c) => {
        const sources = store.evidence(c.dataset, c.provider);
        const provided = args.plans as PricePlan[] | undefined;
        const plans =
          provided ||
          sources.filter((e) => e.metadata.plan).map((e) => e.metadata.plan as PricePlan);
        for (const plan of plans) {
          const e = sources.find((e) => e.id === plan.evidenceId);
          if (!e || !e.content.includes(plan.amount))
            throw new Error('价格缺少对应证据或原文金额不匹配');
          if (c.provider === 'live') validatePriceQuote(plan, e.content);
        }

        return {
          prices: normalizePricing(plans, Number(args.teamSize || 1)),
          note: provided
            ? '价格是模型抽取候选；计算已验证，语义与条件仍须核对来源。'
            : '来自固定资料的确定性计算。',
        };
      },
    },
    compare_snapshots: {
      description: '比较演示资料的基准与变化快照。真实资料不能套用演示变化。',
      schema: object({ threshold: { type: 'number', minimum: 0, maximum: 1000 } }),
      execute: (args, c) => {
        if (c.provider !== 'demo')
          return {
            changes: [],
            note: '真实来源的跨期结构化抽取尚需用户提供两期资料；不能从演示快照推断。',
          };
        const changes = compareFacts(
          commercialFacts('baseline'),
          c.dataset,
          Number(args.threshold ?? 10)
        );
        const current = c.dataset === 'updated' ? '2026-11-01' : '2026-10-25';

        return { synthetic: true, changes, baseline: '2026-10-25', current };
      },
    },
  };
}
