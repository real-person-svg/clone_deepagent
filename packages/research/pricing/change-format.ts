export function percentChangeText(percent: string | null) {
  if (!percent) return '';
  const sign = Number(percent) > 0 ? '+' : '';

  return `（${sign}${percent}%）`;
}
