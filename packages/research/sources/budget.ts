// Recognize explicit numeric limits without treating arbitrary source text as policy.
// All limits can only lower the server's hard caps.
export function researchLimits(prompt: string) {
  const digit = '(\\d+|[一二两三四五六七八九十])';
  const search = prompt.match(new RegExp(`最多\\s*${digit}\\s*(?:轮|次)(?:网络)?检索`));
  const pages =
    prompt.match(new RegExp(`最多\\s*${digit}\\s*个(?:页面|网页)`)) ||
    prompt.match(
      new RegExp(
        `最多\\s*(?:\\d+|[一二两三四五六七八九十])\\s*(?:轮|次)(?:网络)?检索[、，,]\\s*${digit}\\s*个(?:页面|网页)`
      )
    );
  const number = (value: string | undefined, cap: number) =>
    value === undefined
      ? cap
      : Math.min(
          cap,
          /^\d+$/.test(value)
            ? Number(value)
            : value === '两'
              ? 2
              : '零一二三四五六七八九十'.indexOf(value)
        );
  return { searches: number(search?.[1], 4), pages: number(pages?.[1], 8) };
}
