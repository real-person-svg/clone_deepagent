import { describe, expect, it } from 'vitest';
import { evidenceExcerpt, evidenceTerms } from '../evidence/search';
describe('长文证据检索', () => {
  it('多关键词不会被当成一个必须连续匹配的短语', () => {
    expect(evidenceTerms('剪映 会员 云空间 会员')).toEqual(['剪映', '会员', '云空间']);
  });
  it('返回文末定价与权益原文，而非仅文首，且控制摘录大小', () => {
    const content =
      '协议说明。'.repeat(1500) +
      '会员连续包月 ¥25.00。' +
      '其他说明。'.repeat(1500) +
      '100G云空间6元/月。';
    const excerpt = evidenceExcerpt(content, '连续包月 100G云空间');
    expect(excerpt).toContain('¥25.00');
    expect(excerpt).toContain('100G云空间6元/月');
    expect(excerpt.length).toBeLessThanOrEqual(3600);
    expect(excerpt).toContain('原文字符');
  });
});
