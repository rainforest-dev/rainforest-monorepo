import type {
  Element,
  Root as HastRoot,
  RootContent as HastContent,
} from 'hast';
import type { PhrasingContent, Root, RootContent } from 'mdast';
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

import { type ResolvedLink, WIKILINK_PATTERN } from '@/lib/kb';

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

export interface ParsedBody {
  tree: Root;
  /** The first `# ` heading, taken out of the tree because the page renders the title. */
  title?: string;
}

/** Parses a body into Markdown AST. */
export function parseBody(body: string): ParsedBody {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body) as Root;
  const h1 = tree.children.findIndex(
    (n) => n.type === 'heading' && n.depth === 1,
  );
  const title =
    h1 === -1 ? undefined : toString(tree.children[h1]).trim() || undefined;
  if (h1 !== -1) tree.children.splice(h1, 1);
  return { tree, title };
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

/** Renders a parsed tree to sanitised HTML with its wikilinks resolved. */
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
