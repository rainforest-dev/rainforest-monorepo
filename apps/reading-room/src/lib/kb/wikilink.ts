import { type KbDoc } from './model';
import { isPrivateVaultPath } from './privacy';

/** `[[target]]`, `[[target|label]]`, `[[target#heading]]` and the `![[embed]]` form. */
export const WIKILINK_PATTERN = /!?\[\[([^[\]\n]+?)\]\]/g;

export interface Wikilink {
  /** Vault-root-relative path or bare name, without `.md`, heading or alias. */
  target: string;
  /** The alias after `|`, if any. */
  alias?: string;
}

export function parseWikilink(inner: string): Wikilink {
  const pipe = inner.indexOf('|');
  const rawTarget = pipe === -1 ? inner : inner.slice(0, pipe);
  const alias =
    pipe === -1 ? undefined : inner.slice(pipe + 1).trim() || undefined;
  const target = rawTarget
    .split('#')[0]
    .trim()
    .replace(/^\.?\//, '')
    .replace(/\.md$/i, '');
  return { target, alias };
}

/** Finds visible documents by the names a wikilink can use. */
export interface KbLookup {
  wiki(path: string): KbDoc | undefined;
  readwise(path: string): KbDoc | undefined;
  /** A Readwise document by its file name alone, for a bare `[[name]]`. */
  readwiseByName(name: string): KbDoc | undefined;
  /** Whether a wiki or Readwise path names a file that was kept out. */
  hidden(target: string): boolean;
}

export type ResolvedLink =
  /** A page inside the knowledge base. */
  | { kind: 'kb'; doc: KbDoc; label: string }
  /** A vault note the knowledge base does not mount; opened in the local Obsidian app. */
  | { kind: 'obsidian'; href: string; label: string }
  /** A page that is not here, or is kept out: shown as plain text. */
  | { kind: 'missing'; label: string }
  /** A private or company note: neither its path nor its name is shown. */
  | { kind: 'private'; label: string };

export const PRIVATE_LINK_LABEL = '私人筆記';

const basename = (path: string): string => path.split('/').pop() ?? path;

export function obsidianHref(vault: string, path: string): string {
  return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(path)}`;
}

/**
 * Where a wikilink goes. Wiki pages use vault-root paths (`pages/x`, `readwise/articles/y`,
 * `notes/frontend/z`); the first two stay in the knowledge base, a private path is withheld,
 * and every other note opens in Obsidian.
 */
export function resolveWikilink(
  link: Wikilink,
  lookup: KbLookup,
  vault: string,
): ResolvedLink {
  const target = link.target.replace(/^notes\/wiki\//, '');
  if (!target || isPrivateVaultPath(target) || lookup.hidden(target))
    return { kind: 'private', label: PRIVATE_LINK_LABEL };

  const label = link.alias ?? basename(target);
  const found = target.startsWith('pages/')
    ? lookup.wiki(target.slice('pages/'.length))
    : target.startsWith('readwise/')
      ? lookup.readwise(target.slice('readwise/'.length))
      : target.includes('/')
        ? undefined
        : (lookup.wiki(target) ?? lookup.readwiseByName(target));
  if (found)
    return { kind: 'kb', doc: found, label: link.alias ?? found.title };

  // A wiki or Readwise path that is not here was kept out or never existed; a bare name is
  // most likely a page too. Neither gets an Obsidian link that could name a hidden note.
  if (
    !target.includes('/') ||
    target.startsWith('pages/') ||
    target.startsWith('readwise/') ||
    target.startsWith('wiki/')
  )
    return { kind: 'missing', label };
  return { kind: 'obsidian', href: obsidianHref(vault, target), label };
}

/** Every wikilink target in a text, in order, duplicates kept. */
export function wikilinkTargets(text: string): Wikilink[] {
  return [...text.matchAll(WIKILINK_PATTERN)].map((m) => parseWikilink(m[1]));
}
