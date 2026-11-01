import Decimal from 'decimal.js';
import type { Dataset, NormalizedPrice, PricePlan } from '../../contracts/index';
import { fixturePlans } from '../fixtures';

export function normalizePricing(plans: PricePlan[], teamSize = 1): NormalizedPrice[] {
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 10000)
    throw new Error('团队人数必须为 1 至 10000 的整数');

  return plans.map((plan) => {
    const amount = new Decimal(plan.amount);
    if (!amount.isFinite() || amount.isNegative()) throw new Error('价格必须为非负有限数值');
    const monthly = plan.billingPeriod === 'year' ? amount.div(12) : amount;
    const annual = plan.billingPeriod === 'year' ? amount : amount.mul(12);
    const seats = plan.unit === 'seat' ? Math.max(teamSize, plan.minimumSeats) : 1;

    return {
      ...plan,
      monthlyEquivalent: monthly.toFixed(2),
      annualTotal: annual.mul(seats).toFixed(2),
      teamSize,
      teamMonthly: monthly.mul(seats).toFixed(2),
      conditions: `${plan.billingPeriod === 'year' ? '按年付款，月均值不代表可月付' : '按月付款'}；${plan.unit === 'seat' ? `最低 ${plan.minimumSeats} 席，按 ${seats} 席计算` : '按工作空间计费'}；${plan.currency}，税费以来源为准；额度单位不同，不直接比较单次成本`,
    };
  });
}
export interface CommercialChange {
  competitor: string;
  field: string;
  oldValue: string;
  newValue: string;
  percent: string | null;
  oldEvidenceId: string;
  newEvidenceId: string;
}
export function commercialFacts(dataset: Dataset) {
  return Object.fromEntries(
    fixturePlans(dataset).flatMap((p) => [
      [`${p.competitor}.price`, p.amount],
      [`${p.competitor}.rights`, p.commercialRights],
    ])
  );
}
export function compareFacts(
  baseline: Record<string, string>,
  dataset: Dataset,
  threshold: number
): CommercialChange[] {
  const result: CommercialChange[] = [];
  for (const p of fixturePlans(dataset)) {
    const price = baseline[`${p.competitor}.price`];
    const rights = baseline[`${p.competitor}.rights`];
    if (price !== undefined && price !== p.amount && new Decimal(price).gt(0)) {
      const percent = new Decimal(p.amount).minus(price).div(price).mul(100);
      if (percent.abs().gt(threshold))
        result.push({
          competitor: p.competitor,
          field: '月付价格',
          oldValue: price,
          newValue: p.amount,
          percent: percent.toFixed(2),
          oldEvidenceId: `fx_${p.competitor.toLowerCase()}_pricing_${dataset === 'updated' ? 'baseline' : 'updated'}`,
          newEvidenceId: p.evidenceId,
        });
    }
    if (rights !== undefined && rights !== p.commercialRights)
      result.push({
        competitor: p.competitor,
        field: '商用授权',
        oldValue: rights,
        newValue: p.commercialRights,
        percent: null,
        oldEvidenceId: `fx_${p.competitor.toLowerCase()}_terms_${dataset === 'updated' ? 'baseline' : 'updated'}`,
        newEvidenceId: `fx_${p.competitor.toLowerCase()}_terms_${dataset}`,
      });
  }

  return result;
}
