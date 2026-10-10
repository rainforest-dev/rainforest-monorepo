import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import type { LinkPreview } from '@/lib/links.ts';

export type LookupAll = (hostname: string) => Promise<string[]>;

type FetchDeps = {
  fetch?: typeof fetch;
  lookup?: LookupAll;
  timeoutMs?: number;
  maxBytes?: number;
};

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024;
const MAX_URL_LENGTH = 2048;
const TITLE_MAX = 300;
const DESCRIPTION_MAX = 500;
const USER_AGENT =
  'Mozilla/5.0 (compatible; MemoriesLinkPreview/1.0; +https://rainforest.tools)';

const systemLookup: LookupAll = async (hostname) =>
  (await dnsLookup(hostname, { all: true, verbatim: true })).map(
    ({ address }) => address,
  );

function ipv4Octets(address: string): number[] | undefined {
  const parts = address.split('.');
  if (parts.length !== 4) return undefined;
  const octets = parts.map(Number);
  return octets.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
    ? octets
    : undefined;
}

function isPrivateIPv4(address: string): boolean {
  const octets = ipv4Octets(address);
  if (!octets) return true;
  const [a = 0, b = 0, c = 0] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function ipv6Hextets(address: string): number[] | undefined {
  let text = address.toLowerCase().replace(/%.*$/, '');
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted?.[1]) {
    const octets = ipv4Octets(dotted[1]);
    if (!octets) return undefined;
    const [a = 0, b = 0, c = 0, d = 0] = octets;
    text = `${text.slice(0, dotted.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return undefined;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return undefined;
  const groups = [...head, ...Array<string>(missing).fill('0'), ...tail];
  const hextets = groups.map((g) =>
    /^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN,
  );
  return hextets.every((n) => !Number.isNaN(n)) ? hextets : undefined;
}

function isPrivateIPv6(address: string): boolean {
  const h = ipv6Hextets(address);
  if (!h) return true;
  const [h0 = 0, h1 = 0, , , , h5 = 0, h6 = 0, h7 = 0] = h;
  const embedded = `${h6 >> 8}.${h6 & 255}.${h7 >> 8}.${h7 & 255}`;
  const zero = (from: number, to: number) =>
    h.slice(from, to).every((x) => x === 0);
  if (zero(0, 5) && h5 === 0xffff) return isPrivateIPv4(embedded);
  if (h0 === 0x64 && h1 === 0xff9b && zero(2, 6))
    return isPrivateIPv4(embedded);
  return (
    zero(0, 6) ||
    (h0 & 0xfe00) === 0xfc00 ||
    (h0 & 0xffc0) === 0xfe80 ||
    (h0 & 0xffc0) === 0xfec0 ||
    (h0 & 0xff00) === 0xff00 ||
    (h0 === 0x2001 && h1 === 0x0db8) ||
    h0 === 0x2002
  );
}

export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIPv4(address);
  if (family === 6) return isPrivateIPv6(address);
  return true;
}

const LOCAL_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home.arpa',
];

function bareHost(url: URL): string {
  return url.hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();
}

export function checkUrl(raw: string): URL | undefined {
  if (raw.length > MAX_URL_LENGTH) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  if (url.username || url.password) return undefined;
  const host = bareHost(url);
  if (!host || host === 'localhost' || (!host.includes('.') && !isIP(host)))
    return undefined;
  if (LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return undefined;
  if (isIP(host) && isPrivateAddress(host)) return undefined;
  return url;
}

export async function isPublicDestination(
  url: URL,
  lookup: LookupAll = systemLookup,
): Promise<boolean> {
  if (!checkUrl(url.href)) return false;
  const host = bareHost(url);
  if (isIP(host)) return true;
  try {
    const addresses = await lookup(host);
    return addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a));
  } catch {
    return false;
  }
}

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (entity, body: string) => {
      if (body[0] !== '#') return NAMED[body.toLowerCase()] ?? entity;
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    },
  );
}

function clean(text: string | undefined, max: number): string | undefined {
  if (text === undefined) return undefined;
  const flat = decodeEntities(text).replace(/\s+/g, ' ').trim();
  if (!flat) return undefined;
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function attributes(tag: string): Map<string, string> {
  const attrs = new Map<string, string>();
  for (const [, name = '', dq, sq, bare] of tag.matchAll(
    /([^\s=/<>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g,
  )) {
    const key = name.toLowerCase();
    if (!attrs.has(key)) attrs.set(key, dq ?? sq ?? bare ?? '');
  }
  return attrs;
}

function absoluteHttp(
  raw: string | undefined,
  base: string,
): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(decodeEntities(raw.trim()), base);
    return checkUrl(url.href) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function parsePreview(html: string, pageUrl: string): LinkPreview {
  const headEnd = html.search(/<\/head\s*>/i);
  const head = headEnd >= 0 ? html.slice(0, headEnd) : html;
  const meta = new Map<string, string>();
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(tag);
    const key = (attrs.get('property') ?? attrs.get('name'))?.toLowerCase();
    const content = attrs.get('content');
    if (key && content !== undefined && !meta.has(key)) meta.set(key, content);
  }
  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head)?.[1];
  const title = clean(
    meta.get('og:title') ?? meta.get('twitter:title') ?? titleTag,
    TITLE_MAX,
  );
  const description = clean(
    meta.get('og:description') ??
      meta.get('twitter:description') ??
      meta.get('description'),
    DESCRIPTION_MAX,
  );
  const image = absoluteHttp(
    meta.get('og:image:secure_url') ??
      meta.get('og:image') ??
      meta.get('og:image:url') ??
      meta.get('twitter:image') ??
      meta.get('twitter:image:src'),
    pageUrl,
  );
  const siteName = clean(meta.get('og:site_name'), TITLE_MAX);
  return {
    url: pageUrl,
    ...(title && { title }),
    ...(description && { description }),
    ...(image && { image }),
    ...(siteName && { siteName }),
  };
}

function charsetOf(contentType: string, head: Uint8Array): string {
  const declared =
    /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(
      new TextDecoder('latin1').decode(head.subarray(0, 2048)),
    )?.[1];
  return declared?.toLowerCase() ?? 'utf-8';
}

async function readCapped(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } finally {
    void reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(Math.min(size, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const take = chunk.subarray(0, bytes.length - offset);
    bytes.set(take, offset);
    offset += take.length;
    if (offset >= bytes.length) break;
  }
  return bytes;
}

function decode(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export async function fetchPreview(
  target: string,
  {
    fetch: fetchImpl = fetch,
    lookup = systemLookup,
    timeoutMs = TIMEOUT_MS,
    maxBytes = MAX_BYTES,
  }: FetchDeps = {},
): Promise<LinkPreview> {
  const failed: LinkPreview = { url: target };
  const signal = AbortSignal.timeout(timeoutMs);
  let current = checkUrl(target);
  try {
    for (let hop = 0; current && hop <= MAX_REDIRECTS; hop++) {
      if (!(await isPublicDestination(current, lookup))) return failed;
      const response = await fetchImpl(current, {
        redirect: 'manual',
        signal,
        headers: {
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'accept-language': 'zh-TW,zh;q=0.9,en;q=0.8',
          'user-agent': USER_AGENT,
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        void response.body?.cancel().catch(() => undefined);
        current = location
          ? checkUrl(new URL(location, current).href)
          : undefined;
        continue;
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !response.body || !/html/i.test(contentType)) {
        void response.body?.cancel().catch(() => undefined);
        return failed;
      }
      const bytes = await readCapped(response.body, maxBytes);
      const html = decode(bytes, charsetOf(contentType, bytes));
      return { ...parsePreview(html, current.href), url: target };
    }
  } catch {
    return failed;
  }
  return failed;
}

type CacheEntry = { value: Promise<LinkPreview>; expires: number };

type CacheOptions = {
  max?: number;
  ttlMs?: number;
  failureTtlMs?: number;
  now?: () => number;
  load?: (url: string) => Promise<LinkPreview>;
};

export type PreviewCache = { get(url: string): Promise<LinkPreview> };

export function previewCache({
  max = 500,
  ttlMs = 24 * 60 * 60 * 1000,
  failureTtlMs = 10 * 60 * 1000,
  now = Date.now,
  load = (url) => fetchPreview(url),
}: CacheOptions = {}): PreviewCache {
  const entries = new Map<string, CacheEntry>();
  return {
    get(url) {
      const hit = entries.get(url);
      if (hit && hit.expires > now()) {
        entries.delete(url);
        entries.set(url, hit);
        return hit.value;
      }
      entries.delete(url);
      const entry: CacheEntry = {
        value: load(url),
        expires: now() + failureTtlMs,
      };
      entries.set(url, entry);
      void entry.value.then(
        (preview) => {
          if (preview.title) entry.expires = now() + ttlMs;
        },
        () => entries.delete(url),
      );
      while (entries.size > max) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
      return entry.value;
    },
  };
}

let shared: PreviewCache | undefined;
export const sharedPreviewCache = () => (shared ??= previewCache());

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'private, max-age=3600',
};

export async function handleLinkPreview(
  requestUrl: URL,
  cache: PreviewCache = sharedPreviewCache(),
): Promise<Response> {
  const raw = requestUrl.searchParams.get('url') ?? '';
  const target = checkUrl(raw);
  if (!target)
    return new Response(JSON.stringify({ error: 'invalid url' }), {
      status: 400,
      headers: { ...JSON_HEADERS, 'cache-control': 'no-store' },
    });
  const preview = await cache.get(target.href);
  return new Response(JSON.stringify(preview), { headers: JSON_HEADERS });
}
