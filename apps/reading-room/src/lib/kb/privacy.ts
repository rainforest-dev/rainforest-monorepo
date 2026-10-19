/**
 * What the knowledge base never shows. The mounts are already only the wiki's pages and the
 * Readwise folder, so `notes/personal/` is out of reach; these rules are the second fence,
 * applied to every file before it is indexed, linked or rendered.
 */

const isTrue = (value: unknown): boolean =>
  value === true ||
  value === 1 ||
  (typeof value === 'string' &&
    ['true', 'yes', 'on', '1'].includes(value.trim().toLowerCase()));

/** Path segments that mark private content, wherever they appear. */
const PRIVATE_SEGMENTS = new Set(['personal']);

/** Vault paths a link may point at but the knowledge base must not name. */
const PRIVATE_VAULT_PREFIXES = [/^notes\/personal(\/|$)/i];

function tagList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((t) => typeof t === 'string');
  if (typeof value === 'string') return value.split(/[\s,]+/).filter(Boolean);
  return [];
}

/**
 * Whether a document's frontmatter keeps it out: `private` or `wiki_exclude` set, or a
 * `personal/` tag.
 */
export function isHiddenFrontmatter(
  frontmatter: Record<string, unknown>,
): boolean {
  if (isTrue(frontmatter.private) || isTrue(frontmatter.wiki_exclude))
    return true;
  const tags = [
    ...tagList(frontmatter.tags),
    ...tagList(frontmatter.wiki_tag),
  ].map((t) => t.replace(/^#/, '').toLowerCase());
  return tags.some((t) => t === 'personal' || t.startsWith('personal/'));
}

/** Whether a file path under a mount crosses a private folder. */
export function isPrivatePath(path: string): boolean {
  return path
    .split('/')
    .some((segment) => PRIVATE_SEGMENTS.has(segment.toLowerCase()));
}

/** Whether a vault-root-relative link target must not be shown or linked. */
export function isPrivateVaultPath(path: string): boolean {
  return (
    PRIVATE_VAULT_PREFIXES.some((re) => re.test(path)) || isPrivatePath(path)
  );
}
