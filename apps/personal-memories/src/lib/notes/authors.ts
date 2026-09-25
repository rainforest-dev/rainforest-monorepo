import type { Annotation } from './types.ts';

// The app is only reachable behind Cloudflare Access, which sets this header on every request.
export const IDENTITY_HEADER = 'cf-access-authenticated-user-email';
const MAX_NAME = 40;

export function cleanName(raw: string): string {
  const collapsed = raw
    .replace(/%%|[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Array.from splits by code point, so a truncation never cuts a surrogate pair in half.
  return Array.from(collapsed).slice(0, MAX_NAME).join('').trim();
}

export function parseAuthors(raw: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const pair of (raw ?? '').split(',')) {
    const at = pair.indexOf('=');
    if (at < 1) continue;
    const email = pair.slice(0, at).trim().toLowerCase();
    const name = cleanName(pair.slice(at + 1));
    if (email && name) out.set(email, name);
  }
  return out;
}

export function viewerName(
  headers: Headers,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const email = headers.get(IDENTITY_HEADER)?.trim().toLowerCase();
  return email ? parseAuthors(env['MEMORIES_AUTHORS']).get(email) : undefined;
}

export type Signable = Pick<
  Annotation,
  'eventId' | 'at' | 'source' | 'author' | 'excerpt'
> & { by?: string | undefined; origin?: string | undefined };

const ORIGIN_SEP = '\u0000';

function fnv1aHex(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function originOf(
  a: Pick<Signable, 'eventId' | 'at' | 'source' | 'author' | 'excerpt'>,
): string {
  if (a.eventId) return `e:${a.eventId}`;
  const tuple = [a.at, a.source, a.author, a.excerpt].join(ORIGIN_SEP);
  return `t:${fnv1aHex(tuple)}`;
}

export function stampAuthors<T extends Signable>(
  annotations: readonly T[],
  stored: readonly Signable[],
  viewer: string | undefined,
): T[] {
  return annotations.map((a) => {
    const { by: sent, origin, ...rest } = a;
    const key = origin ?? originOf(rest);
    const before = stored.find((s) => originOf(s) === key);
    const by = before
      ? before.by
      : (viewer ?? (cleanName(sent ?? '') || undefined));
    return (by ? { ...rest, by } : rest) as T;
  });
}
