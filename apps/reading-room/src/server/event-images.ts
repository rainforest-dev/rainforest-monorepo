import { type LibraryEvent } from '@rainforest-dev/library-contract';

/**
 * Pictures for events whose source gives none: the `og:image` of the event's own page. Pages are
 * read in the background, a few at a time, so a page render never waits on an organiser's
 * site; an event gets its picture on a render after its page has been read.
 */

/**
 * A page's picture rarely changes; one that had none is asked again a day later, and one that
 * could not be read (a timeout, an error status) an hour later.
 */
const FOUND_TTL_MS = 7 * 24 * 60 * 60_000;
const MISSING_TTL_MS = 24 * 60 * 60_000;
const FAILED_TTL_MS = 60 * 60_000;
const TIMEOUT_MS = 8_000;
/** `<head>` is near the top; never read more of a page than this. */
const MAX_BYTES = 256 * 1024;
const CONCURRENCY = 4;
/** One picture on this many pages is a site's logo, not the event's. */
const LOGO_PAGES = 3;
/** Hosts whose pages need a login or a script before they show a picture. */
const SKIP_HOSTS =
  /(^|\.)(facebook\.com|fb\.me|instagram\.com|cloud\.culture\.tw)$/i;

/** Redirects followed by hand, so each hop's host is checked. */
const MAX_REDIRECTS = 3;

/**
 * Whether a host is somewhere on the internet rather than this machine or its network. A feed
 * names the page, so a page on a private address would have the homelab read its own network.
 * Names that resolve to a private address are not caught; literals and local names are.
 */
export function isPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host.includes('.') && !host.includes(':')) return false;
  if (/(^|\.)(localhost|local|internal|lan|home\.arpa)$/.test(host))
    return false;
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b < 128) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b < 32) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (host.includes(':'))
    return !(
      host === '::' ||
      host === '::1' ||
      /^f[cd]/.test(host) ||
      /^fe[89ab]/.test(host) ||
      host.startsWith('::ffff:')
    );
  return true;
}

interface Entry {
  image: string | null;
  at: number;
  failed: boolean;
}

const pages = new Map<string, Entry>();
const queue = new Set<string>();
/** Pages being read now, so a render meanwhile does not queue them again. */
const reading = new Set<string>();
let running = 0;
/** For the e2e suite, whose pages are served from loopback. */
let allowPrivate = false;

/** Forgets every page read; for tests. */
export function resetEventImages() {
  pages.clear();
  queue.clear();
  reading.clear();
  running = 0;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
};

/** One pass, so `&amp;quot;` stays `&quot;`. */
function decode(text: string): string {
  return text.replace(/&(?:amp|quot|#39|lt|gt);/g, (m) => ENTITIES[m] ?? m);
}

/** An http(s) URL, resolved against `base`, or `undefined`. */
export function webImageUrl(
  raw: string | null | undefined,
  base?: string,
): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(decode(trimmed), base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    const href = url.href;
    return href.length <= 2048 ? href : undefined;
  } catch {
    return undefined;
  }
}

/** The page's `og:image` or `twitter:image`, resolved against the page's URL. */
export function ogImageOf(html: string, pageUrl: string): string | undefined {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (
      !name ||
      !/^(og:image(:secure_url|:url)?|twitter:image(:src)?)$/i.test(name)
    )
      continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
    const url = webImageUrl(content, pageUrl);
    if (url) return url;
  }
  return undefined;
}

/** The page worth reading for an event's picture, or `undefined`. */
function pageOf(event: LibraryEvent): string | undefined {
  if (event.image || !event.url) return undefined;
  try {
    const { hostname } = new URL(event.url);
    if (SKIP_HOSTS.test(hostname)) return undefined;
    return allowPrivate || isPublicHost(hostname) ? event.url : undefined;
  } catch {
    return undefined;
  }
}

async function readHead(fetcher: typeof fetch, url: string): Promise<string> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let target = url;
  let response: Response | undefined;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    response = await fetcher(target, {
      signal,
      redirect: 'manual',
      headers: {
        accept: 'text/html',
        'user-agent':
          'rainforest-library/1.0 (+https://library.rainforest.tools)',
      },
    });
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) break;
    const next = new URL(location, target);
    if (
      !/^https?:$/.test(next.protocol) ||
      (!allowPrivate && !isPublicHost(next.hostname))
    )
      throw new Error(`redirect from ${url} to a host it may not read`);
    await response.body?.cancel().catch(() => undefined);
    target = next.href;
    response = undefined;
  }
  if (!response) throw new Error(`too many redirects from ${url}`);
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  let bytes = 0;
  while (bytes < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    html += decoder.decode(value, { stream: true });
    if (/<\/head>/i.test(html)) break;
  }
  await reader.cancel().catch(() => undefined);
  return html;
}

function pump(fetcher: typeof fetch, now: number) {
  while (running < CONCURRENCY && queue.size > 0) {
    const url = queue.values().next().value as string;
    queue.delete(url);
    reading.add(url);
    running++;
    readHead(fetcher, url)
      .then((html) => ({ image: ogImageOf(html, url) ?? null, failed: false }))
      .catch(() => ({ image: null, failed: true }))
      .then(({ image, failed }) => {
        // A page that fails to answer keeps the picture it last gave.
        const kept = failed ? (pages.get(url)?.image ?? null) : image;
        pages.set(url, { image: kept, at: now, failed });
        reading.delete(url);
        running--;
        pump(fetcher, now);
      });
  }
}

/**
 * The events with each one's picture from its page, when that page has been read. Pages not
 * read yet, or read too long ago, are queued to be read in the background.
 */
export function withPageImages(
  events: readonly LibraryEvent[],
  fetcher: typeof fetch = fetch,
  now = Date.now(),
  options: { allowPrivate?: boolean } = {},
): LibraryEvent[] {
  allowPrivate = options.allowPrivate ?? false;
  // Forget pages no current event links to, once they would be read again anyway.
  const current = new Set(events.map(pageOf));
  for (const [url, entry] of pages)
    if (!current.has(url) && now - entry.at >= FOUND_TTL_MS) pages.delete(url);

  const found = new Map<string, string>();
  for (const event of events) {
    const page = pageOf(event);
    if (!page) continue;
    const entry = pages.get(page);
    const ttl = entry?.failed
      ? FAILED_TTL_MS
      : entry?.image
        ? FOUND_TTL_MS
        : MISSING_TTL_MS;
    if (!reading.has(page) && (!entry || now - entry.at >= ttl))
      queue.add(page);
    if (entry?.image) found.set(event.id, entry.image);
  }
  pump(fetcher, now);

  // A logo is told apart by how many pages share it, so count every page read, and give a site
  // no pictures while its pages are still waiting to be read.
  const sharing = new Map<string, number>();
  for (const { image } of pages.values())
    if (image) sharing.set(image, (sharing.get(image) ?? 0) + 1);
  const pending = new Set([...queue, ...reading].map(hostOf));
  return events.map((event) => {
    const image = found.get(event.id);
    return image &&
      (sharing.get(image) ?? 0) < LOGO_PAGES &&
      !pending.has(hostOf(event.url ?? ''))
      ? { ...event, image }
      : event;
  });
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** Resolves once every queued page has been read; for tests. */
export async function settleEventImages(): Promise<void> {
  while (running > 0 || queue.size > 0)
    await new Promise((resolve) => setTimeout(resolve, 5));
}
