import Decimal from 'decimal.js';
import type { NormalizedPrice, PricePlan } from '../../contracts/index';

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
