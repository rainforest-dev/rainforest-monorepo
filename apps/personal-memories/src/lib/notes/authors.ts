import type { Annotation } from './types.ts';

// The app is only reachable behind Cloudflare Access, which sets this header on every request.
export const IDENTITY_HEADER = 'cf-access-authenticated-user-email';
const MAX_NAME = 40;

export function cleanName(raw: string): string {
  return raw
    .replace(/%%|[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
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
> & { by?: string | undefined };

const sameAnchor = (a: Signable, b: Signable) =>
  (!!a.eventId && a.eventId === b.eventId) ||
  (a.at === b.at &&
    a.source === b.source &&
    a.author === b.author &&
    a.excerpt === b.excerpt);

export function stampAuthors<T extends Signable>(
  annotations: readonly T[],
  stored: readonly Signable[],
  viewer: string | undefined,
): T[] {
  return annotations.map((a) => {
    const { by: sent, ...rest } = a;
    const before = stored.find((s) => sameAnchor(a, s));
    const by = before ? before.by : cleanName(sent ?? '') || viewer;
    return (by ? { ...rest, by } : rest) as T;
  });
}
