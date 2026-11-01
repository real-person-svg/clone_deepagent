import * as cheerio from 'cheerio';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';
export function isPublicIpv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    return false;
  const [a, b] = parts;

  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0)
  );
}

export function pinnedLookup(address: string): LookupFunction {
  return (_host, options, callback) => {
    if (options.all) callback(null, [{ address, family: 4 }]);
    else callback(null, address, 4);
  };
}

export async function fetchPublicResource(
  input: string,
  signal: AbortSignal,
  redirects = 0
): Promise<{ url: string; type: string; body: string }> {
  if (redirects > 4) throw new Error('页面重定向次数过多');
  const url = new URL(input);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !['80', '443'].includes(url.port))
  )
    throw new Error('仅支持公共 HTTP(S) 页面及标准端口');
  const addresses = await lookup(url.hostname, { family: 4, all: true });
  if (!addresses.length || addresses.some((a) => !isPublicIpv4(a.address)))
    throw new Error('禁止访问本机、内网或保留地址');
  const pinned = addresses[0].address;
  const response = await new Promise<{
    status: number;
    location?: string;
    type: string;
    body: string;
  }>((resolve, reject) => {
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = send(
      url,
      {
        signal,
        timeout: 15000,
        headers: {
          'User-Agent': 'AgentResearchWorkspace/0.1',
          Accept: 'text/html,text/plain,application/rss+xml,application/xml,text/xml',
          'Accept-Encoding': 'identity',
        },
        lookup: pinnedLookup(pinned),
      },
      (res) => {
        let size = 0;
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > 1_500_000) {
            req.destroy(new Error('页面超过 1.5MB 采集上限'));

            return;
          }
          chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('end', () =>
          resolve({
            status: res.statusCode || 0,
            location: res.headers.location,
            type: res.headers['content-type'] || '',
            body: Buffer.concat(chunks).toString('utf8'),
          })
        );
      }
    );
    req.on('timeout', () => req.destroy(new Error('页面采集超时')));
    req.on('error', reject);
    req.end();
  });
  if (response.status >= 300 && response.status < 400 && response.location)
    return fetchPublicResource(new URL(response.location, url).href, signal, redirects + 1);
  if (response.status !== 200)
    throw new Error(`来源返回 HTTP ${response.status}，不能判断产品能力是否存在`);
  return { url: url.href, type: response.type, body: response.body };
}

export async function fetchPublicPage(
  input: string,
  signal: AbortSignal
): Promise<{ url: string; title: string; text: string; links?: { url: string; title: string }[] }> {
  const response = await fetchPublicResource(input, signal);
  const url = new URL(response.url);
  if (!/text\/html|text\/plain|application\/xhtml/.test(response.type))
    throw new Error('目前仅支持 HTML 和纯文本网页');
  const $ = cheerio.load(response.body);
  const title = $('title').text().trim() || url.hostname;
  const links: { url: string; title: string }[] = [];
  const seen = new Set<string>();
  $('a[href]').each((_index, element) => {
    const label = $(element).text().trim().slice(0, 160);
    try {
      const target = new URL($(element).attr('href')!, url);
      target.hash = '';
      if (
        !['http:', 'https:'].includes(target.protocol) ||
        target.username ||
        target.password ||
        (target.port && !['80', '443'].includes(target.port)) ||
        seen.has(target.href) ||
        !/pric|plan|licen|legal|terms|policy|help|support|about|会员|价格|定价|套餐|条款|协议|授权|帮助|关于/i.test(
          `${label} ${target.pathname}`
        )
      )
        return;
      seen.add(target.href);
      links.push({ url: target.href, title: label || target.pathname });
    } catch {
      /* Ignore malformed page links; destination addresses are checked at fetch time. */
    }
  });
  $('script,style,noscript,iframe,svg,nav,header,footer').remove();
  $('br').replaceWith('\n');
  $('p,div,li,tr,h1,h2,h3').append('\n');
  const text = $('body')
    .text()
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
    .slice(0, 60000);
  if (text.length < 40) throw new Error('页面正文不足，可能需要浏览器渲染；请上传资料补充');

  return { url: url.href, title, text, links: links.slice(0, 40) };
}
