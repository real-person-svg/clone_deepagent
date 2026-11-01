import type { PricePlan } from '../../contracts/index';
import { Store } from '../../storage/index';
import { normalizePricing } from '../pricing';
import { validatePriceQuote } from '../pricing/quote';
import { object, string, type Spec } from '../tools/types';
export function createPricingTools(store: Store): Record<string, Spec> {
  return {
    normalize_pricing: {
      description:
        '确定性计算月均成本、12个月支出与最低席位条件。真实资料的plans必须附evidenceId与逐字sourceQuote（400字内，含金额及明确付款周期）；周期未知不得推定。席位数是场景假设，不证明团队授权。',
      schema: object(
        {
          teamSize: { type: 'integer', minimum: 1, maximum: 10000 },
          plans: {
            type: 'array',
            minItems: 1,
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
                'sourceQuote',
              ]
            ),
          },
        },
        ['plans']
      ),
      execute: (args, c) => {
        const sources = store.researchEvidence(c.runId, true);
        const plans = args.plans as PricePlan[];
        for (const plan of plans) {
          const e = sources.find((e) => e.id === plan.evidenceId);
          if (!e || e.competitor !== plan.competitor)
            throw new Error('价格缺少对应证据或产品归属不匹配');
          validatePriceQuote(plan, e.content);
        }

        return {
          prices: normalizePricing(plans, Number(args.teamSize || 1)),
          note: '价格是模型抽取候选；计算已验证，语义与条件仍须核对来源。',
        };
      },
    },
  };
}
