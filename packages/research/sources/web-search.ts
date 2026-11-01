import * as cheerio from 'cheerio';
import { fetchPublicResource, isPublicIpv4 } from './public-page';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}
export function searchResultUrl(input: string) {
  try {
    const url = new URL(input);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      (url.port && !['80', '443'].includes(url.port)) ||
      url.hostname === 'localhost' ||
      url.hostname.endsWith('.local') ||
      url.hostname.startsWith('[') ||
      (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) && !isPublicIpv4(url.hostname))
    )
      return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}
export function parseSearchResults(body: string, maxResults = 5): SearchResult[] {
  const $ = cheerio.load(body, { xmlMode: true });
  if (!$('rss > channel').length)
    throw new Error('公开搜索返回了无法解析的响应；请重试或直接提供官方 URL');
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  $('channel > item').each((_i, item) => {
    const url = searchResultUrl($(item).find('link').first().text().trim());
    if (!url || seen.has(url)) return;
    seen.add(url);
    results.push({
      url,
      title: $(item).find('title').first().text().trim().slice(0, 300),
      snippet: $(item)
        .find('description')
        .first()
        .text()
        .replace(/<[^>]*>/g, '')
        .slice(0, 1000),
    });
  });
  return results.slice(0, maxResults);
}
export async function searchPublicWeb(query: string, signal: AbortSignal, maxResults = 5) {
  const endpoint = new URL('https://www.bing.com/search');
  endpoint.searchParams.set('format', 'rss');
  endpoint.searchParams.set('q', query);
  const response = await fetchPublicResource(
    endpoint.href,
    AbortSignal.any([signal, AbortSignal.timeout(20000)])
  );
  return parseSearchResults(response.body, maxResults);
}
