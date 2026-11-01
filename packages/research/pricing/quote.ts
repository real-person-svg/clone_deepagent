import type { PricePlan } from '../../contracts/index';
export function validatePriceQuote(plan: PricePlan, content: string) {
  const quote = plan.sourceQuote?.trim();

  const normalize = (value: string) => value.replace(/\s+/g, '').toLocaleLowerCase();
  if (!quote || quote.length > 400 || !normalize(content).includes(normalize(quote)))
    throw new Error(
      '真实价格须提供不超过400字、包含金额和付款周期的逐字sourceQuote；缺失或不确定周期不能计算'
    );
  const amounts = quote.replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1').match(/\d+(?:\.\d+)?/g) || [];
  if (!amounts.some((amount) => Number(amount) === Number(plan.amount)))
    throw new Error('价格金额不在所引用的原文片段中');
  if (
    plan.billingPeriod === 'month' &&
    /billed\s*(?:annually|yearly)|annual\s*(?:billing|commitment|payment)|按年(?:付款|付费|支付|结算)|年付/i.test(
      quote
    )
  )
    throw new Error('原文注明年付承诺，不能按可月付套餐计算；请提供年度实际扣费金额与原文');
  const period =
    plan.billingPeriod === 'month'
      ? /包月|每月|月付|\/月|\/month|per\s*month|monthly/i
      : /包年|每年|年付|\/年|\/year|per\s*year|annual/i;
  if (!period.test(quote.replace(/\s+/g, '')))
    throw new Error('原文片段未明确所选付款周期；不得将未注明周期的金额假定为月价或年价');
}
