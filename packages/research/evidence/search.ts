export function evidenceTerms(query: string) {
  return [
    ...new Set(
      query
        .toLocaleLowerCase()
        .split(/[\s，、；:：,;]+/u)
        .filter(Boolean)
    ),
  ];
}

export function evidenceExcerpt(content: string, query: string, budget = 3600) {
  const lower = content.toLocaleLowerCase();
  const positions = evidenceTerms(query)
    .map((term) => lower.indexOf(term))
    .filter((position) => position >= 0);
  if (!positions.length) return content.slice(0, budget);
  const radius = Math.max(160, Math.floor(budget / Math.min(positions.length, 8) / 2) - 40);
  const ranges: { start: number; end: number }[] = [];
  for (const position of positions.slice(0, 8).sort((a, b) => a - b)) {
    const start = Math.max(0, position - radius),
      end = Math.min(content.length, position + radius);
    const previous = ranges.at(-1);
    if (previous && start <= previous.end) previous.end = Math.max(previous.end, end);
    else ranges.push({ start, end });
  }

  return ranges
    .map(({ start, end }) => `[原文字符 ${start}–${end}]\n${content.slice(start, end)}`)
    .join('\n[…]\n')
    .slice(0, budget);
}
