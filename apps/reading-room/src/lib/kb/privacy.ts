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

/** Path segments that mark private or company content, wherever they appear. */
const PRIVATE_SEGMENTS = new Set(['personal', 'angible']);

/** Vault paths a link may point at but the knowledge base must not name. */
const PRIVATE_VAULT_PREFIXES = [
  /^notes\/personal(\/|$)/i,
  /^projects\/angible(\/|$)/i,
];

function tagList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((t) => typeof t === 'string');
  if (typeof value === 'string') return value.split(/[\s,]+/).filter(Boolean);
  return [];
}

/**
 * Whether a document's frontmatter keeps it out: `private` or `wiki_exclude` set, a
 * `personal/` tag, or a tag under a company project.
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
  return tags.some(
    (t) =>
      t === 'personal' ||
      t.startsWith('personal/') ||
      t === 'project/angible' ||
      t.startsWith('project/angible/'),
  );
}

/** Whether a file path under a mount crosses a private or company folder. */
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

/**
 * Terms whose mention marks company content. `KB_REDACT_TERMS` replaces the default; internal
 * project names belong there, set by the deployment, not in this public repository.
 */
export const DEFAULT_REDACT_TERMS = ['angible'];

export function redactTerms(env: string | undefined): string[] {
  if (env === undefined) return DEFAULT_REDACT_TERMS;
  return env
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export function mentionsAny(text: string, terms: readonly string[]): boolean {
  if (terms.length === 0) return false;
  const lower = text.toLowerCase();
  return terms.some((t) => lower.includes(t));
}
