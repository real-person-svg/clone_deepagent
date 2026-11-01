import { describe, expect, it } from 'vitest';
import { pinnedLookup } from '../sources/public-page';
describe('公共来源 DNS 固定地址', () => {
  it('兼容 Node 自动 family 选择要求的 all 数组格式', () => {
    let result: unknown;
    pinnedLookup('93.184.216.34')('example.org', { all: true }, (error, address, family) => {
      expect(error).toBeNull();
      result = { address, family };
    });
    expect(result).toEqual({
      address: [{ address: '93.184.216.34', family: 4 }],
      family: undefined,
    });
  });
  it('兼容单地址格式并保持固定 IP，不重新解析主机名', () => {
    let result: unknown;
    pinnedLookup('93.184.216.34')(
      'another.example.org',
      { family: 4 },
      (error, address, family) => {
        expect(error).toBeNull();
        result = { address, family };
      }
    );
    expect(result).toEqual({ address: '93.184.216.34', family: 4 });
  });
});
