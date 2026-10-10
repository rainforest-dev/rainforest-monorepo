export type TextSegment =
  { kind: 'text'; text: string } | { kind: 'link'; href: string; text: string };

const SLACK_LINK = String.raw`<(https?:\/\/[^\s<>|]+)(?:\|([^<>]*))?>`;
const BARE_URL = String.raw`https?:\/\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+`;
const LINK = new RegExp(`${SLACK_LINK}|${BARE_URL}`, 'g');
const TRAILING = /[.,;:!?'"*_~]$/;
const PAIRS: Record<string, string> = { ')': '(', ']': '[' };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>' };
const decodeSlack = (text: string) =>
  text.replace(/&(amp|lt|gt);/g, (_, name: string) => ENTITIES[name] ?? '');

const count = (text: string, char: string) => text.split(char).length - 1;

function trimUrl(url: string): string {
  let end = url;
  for (;;) {
    const last = end.at(-1) ?? '';
    const open = PAIRS[last];
    if (TRAILING.test(end) || (open && count(end, last) > count(end, open)))
      end = end.slice(0, -1);
    else return end;
  }
}

function isHttpUrl(href: string): boolean {
  try {
    const { protocol, hostname } = new URL(href);
    return (protocol === 'http:' || protocol === 'https:') && hostname !== '';
  } catch {
    return false;
  }
}

export function linkSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let plain = '';
  let cursor = 0;
  const flush = () => {
    if (plain) segments.push({ kind: 'text', text: plain });
    plain = '';
  };
  for (const match of text.matchAll(LINK)) {
    const start = match.index;
    const [whole, slackUrl, label] = match;
    plain += text.slice(cursor, start);
    if (slackUrl !== undefined) {
      const href = decodeSlack(slackUrl);
      cursor = start + whole.length;
      if (isHttpUrl(href)) {
        flush();
        const shown = label === undefined ? '' : decodeSlack(label).trim();
        segments.push({ kind: 'link', href, text: shown || href });
      } else {
        plain += whole;
      }
      continue;
    }
    const url = trimUrl(whole);
    cursor = start + url.length;
    if (isHttpUrl(url)) {
      flush();
      segments.push({ kind: 'link', href: url, text: url });
    } else {
      plain += url;
    }
  }
  plain += text.slice(cursor);
  flush();
  return segments;
}

export function firstLink(text: string): string | undefined {
  for (const segment of linkSegments(text))
    if (segment.kind === 'link') return segment.href;
  return undefined;
}

export function previewUrl(href: string): string {
  return `/link-preview.json?url=${encodeURIComponent(href)}`;
}

export const LINK_CLASS =
  'text-primary underline underline-offset-2 hover:decoration-2';

export type LinkPreview = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

const optionalString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : undefined;

export function asLinkPreview(value: unknown): LinkPreview | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const url = optionalString(record['url']);
  const title = optionalString(record['title']);
  if (!url || !isHttpUrl(url) || !title) return undefined;
  const description = optionalString(record['description']);
  const rawImage = optionalString(record['image']);
  const image = rawImage && isHttpUrl(rawImage) ? rawImage : undefined;
  const siteName = optionalString(record['siteName']);
  return {
    url,
    title,
    ...(description && { description }),
    ...(image && { image }),
    ...(siteName && { siteName }),
  };
}
