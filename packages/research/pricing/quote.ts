import type { PricePlan } from '../../contracts/index';
export function validatePriceQuote(plan: PricePlan, content: string) {
  const quote = plan.sourceQuote?.trim();

  const normalize = (value: string) => value.replace(/\s+/g, '').toLocaleLowerCase();
  if (!quote || quote.length > 400 || !normalize(content).includes(normalize(quote)))
    throw new Error(
      '真实价格须提供不超过400字、包含金额和付款周期的逐字sourceQuote；缺失或不确定周期不能计算'
    );
  const amounts = quote.match(/\d+(?:\.\d+)?/g) || [];
  if (!amounts.some((amount) => Number(amount) === Number(plan.amount)))
    throw new Error('价格金额不在所引用的原文片段中');
  const period =
    plan.billingPeriod === 'month'
      ? /包月|每月|月付|\/月|\/month|per month|monthly/i
      : /包年|每年|年付|\/年|\/year|per year|annual/i;
  if (!period.test(quote.replace(/\s+/g, '')))
    throw new Error('原文片段未明确所选付款周期；不得将未注明周期的金额假定为月价或年价');
}
