import { type LibraryEvent } from '@rainforest-dev/library-contract';

/**
 * Pictures for events whose source gives none: the `og:image` of the event's own page. Pages are
 * read in the background, a few at a time, so a page render never waits on an organiser's
 * site; an event gets its picture on a render after its page has been read.
 */

/** A page's picture rarely changes; one that had none is asked again a day later. */
const FOUND_TTL_MS = 7 * 24 * 60 * 60_000;
const MISSING_TTL_MS = 24 * 60 * 60_000;
const TIMEOUT_MS = 8_000;
/** `<head>` is near the top; never read more of a page than this. */
const MAX_BYTES = 256 * 1024;
const CONCURRENCY = 4;
/** One picture on this many pages is a site's logo, not the event's. */
const LOGO_PAGES = 3;
/** Hosts whose pages need a login or a script before they show a picture. */
const SKIP_HOSTS =
  /(^|\.)(facebook\.com|fb\.me|instagram\.com|cloud\.culture\.tw)$/i;

interface Entry {
  image: string | null;
  at: number;
}

const pages = new Map<string, Entry>();
const queue = new Set<string>();
let running = 0;

/** Forgets every page read; for tests. */
export function resetEventImages() {
  pages.clear();
  queue.clear();
  running = 0;
}

function decode(text: string): string {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
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
    return SKIP_HOSTS.test(new URL(event.url).hostname) ? undefined : event.url;
  } catch {
    return undefined;
  }
}

async function readHead(fetcher: typeof fetch, url: string): Promise<string> {
  const response = await fetcher(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      accept: 'text/html',
      'user-agent':
        'rainforest-library/1.0 (+https://library.rainforest.tools)',
    },
  });
  if (!response.ok || !response.body) return '';
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
    running++;
    readHead(fetcher, url)
      .then((html) => ogImageOf(html, url) ?? null)
      .catch(() => null)
      .then((image) => {
        pages.set(url, { image, at: now });
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
): LibraryEvent[] {
  const found = new Map<string, string>();
  for (const event of events) {
    const page = pageOf(event);
    if (!page) continue;
    const entry = pages.get(page);
    const ttl = entry?.image ? FOUND_TTL_MS : MISSING_TTL_MS;
    if (!entry || now - entry.at >= ttl) queue.add(page);
    if (entry?.image) found.set(event.id, entry.image);
  }
  pump(fetcher, now);

  const pagesOf = new Map<string, Set<string>>();
  for (const event of events) {
    const image = found.get(event.id);
    if (!image || !event.url) continue;
    const set = pagesOf.get(image) ?? new Set<string>();
    set.add(event.url);
    pagesOf.set(image, set);
  }
  return events.map((event) => {
    const image = found.get(event.id);
    return image && (pagesOf.get(image)?.size ?? 0) < LOGO_PAGES
      ? { ...event, image }
      : event;
  });
}

/** Resolves once every queued page has been read; for tests. */
export async function settleEventImages(): Promise<void> {
  while (running > 0 || queue.size > 0)
    await new Promise((resolve) => setTimeout(resolve, 5));
}
