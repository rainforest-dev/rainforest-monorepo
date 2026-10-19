import type {
  Element,
  Root as HastRoot,
  RootContent as HastContent,
} from 'hast';
import type { Parent, PhrasingContent, Root, RootContent } from 'mdast';
import { findAndReplace } from 'mdast-util-find-and-replace';
import { toString } from 'mdast-util-to-string';
import rehypeSanitize, {
  defaultSchema,
  type Options as SanitizeSchema,
} from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { parse as parseYaml } from 'yaml';

import { mentionsAny, type ResolvedLink, WIKILINK_PATTERN } from '@/lib/kb';

export interface Frontmatter {
  /** The parsed YAML, `{}` when the file has none. */
  data: Record<string, unknown>;
  /** The YAML could not be read, so a `private` flag in it cannot be ruled out. */
  invalid: boolean;
  body: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function splitFrontmatter(raw: string): Frontmatter {
  const text = raw.replace(/^\uFEFF/, '');
  const match = text.match(FRONTMATTER);
  if (!match) return { data: {}, invalid: false, body: text };
  const body = text.slice(match[0].length);
  try {
    const data: unknown = parseYaml(match[1]);
    if (data === null || data === undefined)
      return { data: {}, invalid: false, body };
    if (typeof data !== 'object' || Array.isArray(data))
      return { data: {}, invalid: true, body };
    return { data: data as Record<string, unknown>, invalid: false, body };
  } catch {
    return { data: {}, invalid: true, body };
  }
}

/** Block nodes dropped whole when they mention a redacted term. */
const REDACTABLE = new Set([
  'paragraph',
  'listItem',
  'tableRow',
  'blockquote',
  'heading',
  'code',
  'html',
  'definition',
  'footnoteDefinition',
]);
const DROP_WHEN_EMPTY = new Set(['list', 'table', 'blockquote']);

/** A node's text plus every URL, title and alt text in it, which render as attributes. */
function textWithUrls(node: RootContent): string {
  const parts = [toString(node)];
  const walk = (n: RootContent) => {
    for (const field of ['url', 'title', 'alt'] as const)
      if (field in n && typeof n[field as keyof typeof n] === 'string')
        parts.push(n[field as keyof typeof n] as string);
    if ('children' in n) n.children.forEach((c) => walk(c as RootContent));
  };
  walk(node);
  return parts.join('\n');
}

function redact(node: Parent, terms: readonly string[]): void {
  node.children = node.children.filter((child) => {
    if (REDACTABLE.has(child.type) && mentionsAny(textWithUrls(child), terms))
      return false;
    if ('children' in child) {
      redact(child, terms);
      if (DROP_WHEN_EMPTY.has(child.type) && child.children.length === 0)
        return false;
    }
    return true;
  }) as typeof node.children;
}

const isHeading = (node: RootContent, depth: number) =>
  node.type === 'heading' && node.depth <= depth;

/** The `## Summary` section, or the first paragraph when there is none. */
function summaryText(tree: Root): string {
  const start = tree.children.findIndex(
    (n) =>
      n.type === 'heading' &&
      n.depth === 2 &&
      /^summary$/i.test(toString(n).trim()),
  );
  if (start === -1) {
    const first = tree.children.find((n) => n.type === 'paragraph');
    return first ? toString(first) : '';
  }
  const rest = tree.children.slice(start + 1);
  const end = rest.findIndex((n) => isHeading(n, 2));
  return (end === -1 ? rest : rest.slice(0, end))
    .map((n) => toString(n))
    .join('\n');
}

export interface ParsedBody {
  tree: Root;
  /** The first `# ` heading, taken out of the tree because the page renders the title. */
  title?: string;
  /** The page is about company work: its title or summary names a redacted term. */
  company: boolean;
}

/**
 * Parses a body and removes what must not be shown. A page whose title or summary names a
 * redacted term is company work and is hidden whole; elsewhere, only the blocks that name
 * one are dropped.
 */
export function parseBody(body: string, terms: readonly string[]): ParsedBody {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body) as Root;
  const h1 = tree.children.findIndex(
    (n) => n.type === 'heading' && n.depth === 1,
  );
  const title =
    h1 === -1 ? undefined : toString(tree.children[h1]).trim() || undefined;
  if (h1 !== -1) tree.children.splice(h1, 1);
  const company =
    mentionsAny(title ?? '', terms) || mentionsAny(summaryText(tree), terms);
  redact(tree, terms);
  return { tree, title, company };
}

/** The prose a reader sees, for search and wikilink extraction; code is left out. */
export function plainText(tree: Root): string {
  const parts: string[] = [];
  const walk = (node: Root | RootContent) => {
    if (node.type === 'code' || node.type === 'html') return;
    if (node.type === 'text') parts.push(node.value);
    if (node.type === 'inlineCode') parts.push(node.value);
    if ('children' in node) {
      for (const child of node.children) walk(child);
      if (
        node.type === 'paragraph' ||
        node.type === 'heading' ||
        node.type === 'listItem'
      )
        parts.push('\n');
    }
  };
  walk(tree);
  return parts
    .join('')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function linkNode(link: ResolvedLink): PhrasingContent {
  const text = { type: 'text' as const, value: link.label };
  if (link.kind === 'kb')
    return {
      type: 'link',
      url: link.doc.href,
      children: [text],
      data: { hProperties: { dataKind: 'kb' } },
    };
  if (link.kind === 'obsidian')
    return {
      type: 'link',
      url: link.href,
      title: '在 Obsidian 開啟',
      children: [text],
      data: { hProperties: { dataKind: 'obsidian' } },
    };
  return {
    type: 'emphasis',
    children: [text],
    data: { hName: 'span', hProperties: { dataKind: link.kind } },
  };
}

const SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), 'obsidian'],
  },
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), 'dataKind', 'title'],
    span: [...(defaultSchema.attributes?.span ?? []), 'dataKind'],
  },
};

/** After sanitising: web links open in a new tab, images load lazily without a referrer. */
function rehypeOutbound() {
  const walk = (node: HastRoot | HastContent) => {
    if (node.type === 'element') decorate(node);
    if ('children' in node) for (const child of node.children) walk(child);
  };
  const decorate = (el: Element) => {
    const href = el.properties.href;
    if (
      el.tagName === 'a' &&
      typeof href === 'string' &&
      /^https?:/i.test(href)
    ) {
      el.properties.target = '_blank';
      el.properties.rel = ['noreferrer'];
    }
    if (el.tagName === 'img') {
      el.properties.loading = 'lazy';
      el.properties.referrerPolicy = 'no-referrer';
    }
  };
  return (tree: HastRoot) => walk(tree);
}

/** Renders a parsed, redacted tree to sanitised HTML with its wikilinks resolved. */
export function renderTree(
  tree: Root,
  resolve: (inner: string) => ResolvedLink,
): string {
  findAndReplace(tree, [
    [
      new RegExp(WIKILINK_PATTERN.source, 'g'),
      (_match: string, inner: string) => linkNode(resolve(inner)),
    ],
  ]);
  const processor = unified()
    .use(remarkRehype)
    .use(rehypeSanitize, SCHEMA)
    .use(rehypeOutbound)
    .use(rehypeStringify);
  return processor.stringify(processor.runSync(tree) as HastRoot);
}
