import { describe, expect, it } from 'vitest';
import type { PricePlan } from '../../contracts/index';
import { validatePriceQuote } from '../pricing/quote';
describe('真实价格的证据口径', () => {
  const plan: PricePlan = {
    competitor: '剪映',
    plan: '会员',
    amount: '25',
    currency: 'CNY',
    billingPeriod: 'month',
    unit: 'seat',
    minimumSeats: 1,
    quota: '未知',
    commercialRights: '未知',
    api: '未知',
    evidenceId: 'source_test',
    sourceQuote: '剪映会员连续包月 ¥25.00',
  };
  it('接受来源中明确的月价，拒绝伪造摘录', () => {
    expect(() => validatePriceQuote(plan, 'App内购买 剪映会员连续包月 ¥25.00')).not.toThrow();
    expect(() => validatePriceQuote(plan, '剪映会员 ¥25.00')).toThrow('逐字');
  });
  it('阻止把未注明周期的SVIP59元按月计算', () => {
    expect(() =>
      validatePriceQuote(
        { ...plan, amount: '59', sourceQuote: '剪映SVIP会员 ¥59.00' },
        '剪映SVIP会员 ¥59.00'
      )
    ).toThrow('付款周期');
  });
  it('拒绝将年付承诺中的月均值当作可月付价格', () => {
    const sourceQuote = 'USD 25 per month, billed annually';
    expect(() => validatePriceQuote({ ...plan, sourceQuote }, sourceQuote)).toThrow('年付承诺');
  });
  it('支持带千位分隔符的明确年度金额与英文付款周期', () => {
    const sourceQuote = 'USD 1,200 per year';
    expect(() =>
      validatePriceQuote(
        { ...plan, amount: '1200', billingPeriod: 'year', sourceQuote },
        sourceQuote
      )
    ).not.toThrow();
  });
});
