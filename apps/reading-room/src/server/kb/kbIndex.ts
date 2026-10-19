import { type Dirent, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  isHiddenFrontmatter,
  isPrivatePath,
  type KbDoc,
  kbDocHref,
  kbDocId,
  type KbEntry,
  type KbLookup,
  type KbSource,
  parseWikilink,
  readwiseShelf,
  redactTerms,
  type ResolvedLink,
  resolveWikilink,
  WIKILINK_PATTERN,
  wikiShelf,
} from '@/lib/kb';

import {
  parseBody,
  plainText,
  renderTree,
  splitFrontmatter,
} from './markdown.js';

/** Where the knowledge base reads from, and what it withholds. */
export interface KbConfig {
  roots: Record<KbSource, string>;
  /** The Obsidian vault name for `obsidian://` links to notes that are not mounted. */
  vault: string;
  redact: string[];
}

export function kbConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): KbConfig {
  return {
    roots: {
      wiki: env.KB_WIKI_PATH || '/kb/wiki',
      readwise: env.KB_READWISE_PATH || '/kb/readwise',
    },
    vault: env.KB_OBSIDIAN_VAULT || 'rainforest-obsidian',
    redact: redactTerms(env.KB_REDACT_TERMS),
  };
}

/** Larger files are not notes; skip them rather than parse them on every scan. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

interface KbFile {
  source: KbSource;
  /** Path under the root, `/`-separated, without `.md`. */
  path: string;
  file: string;
  mtimeMs: number;
  size: number;
}

/**
 * Every Markdown file under a root, walked without following symlinks, so a link inside the
 * mount cannot reach the rest of the vault. Hidden entries and private folders are skipped;
 * Readwise files sit in category folders, so its root-level files are not documents.
 */
function scanRoot(source: KbSource, root: string): KbFile[] | null {
  const files: KbFile[] = [];
  const walk = (dir: string, rel: string[]): boolean => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const parts = [...rel, entry.name];
      if (isPrivatePath(parts.join('/'))) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, parts);
        continue;
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md'))
        continue;
      if (source === 'readwise' && rel.length === 0) continue;
      try {
        const stat = statSync(full);
        if (stat.size > MAX_FILE_BYTES) continue;
        files.push({
          source,
          path: parts.join('/').replace(/\.md$/i, ''),
          file: full,
          mtimeMs: stat.mtimeMs,
          size: stat.size,
        });
      } catch {
        // Gone between the listing and the stat: iCloud is mid-sync. The next scan sees it.
      }
    }
    return true;
  };
  return walk(root, []) ? files : null;
}

interface Indexed {
  doc: KbDoc;
  file: KbFile;
  /** Plain text with its wikilinks still in `[[…]]` form. */
  prose: string;
  links: string[];
}

/** Reads one file into a document, or null when it is kept out. */
function indexFile(file: KbFile, config: KbConfig): Indexed | null {
  let raw: string;
  try {
    raw = readFileSync(file.file, 'utf-8');
  } catch {
    return null;
  }
  const fm = splitFrontmatter(raw);
  if (fm.invalid || isHiddenFrontmatter(fm.data)) return null;
  const { tree, title, company } = parseBody(fm.body, config.redact);
  if (company) return null;

  const data = fm.data;
  const str = (v: unknown) =>
    typeof v === 'string'
      ? v
      : v instanceof Date
        ? v.toISOString().slice(0, 10)
        : undefined;
  const tags = (
    file.source === 'wiki'
      ? [data.wiki_tag]
      : Array.isArray(data.tags)
        ? data.tags
        : []
  ).filter((t): t is string => typeof t === 'string' && t.length > 0);
  const name = file.path.split('/').pop() ?? file.path;
  const docTitle = title ?? name;
  // A title, tag, author or source URL naming a redacted term marks company work as surely
  // as the summary does.
  if (
    [docTitle, ...tags, str(data.author) ?? '', str(data.url) ?? ''].some((t) =>
      config.redact.some((r) => t.toLowerCase().includes(r)),
    )
  )
    return null;

  const doc: KbDoc = {
    id: kbDocId(file.source, file.path),
    source: file.source,
    path: file.path,
    title: docTitle,
    href: kbDocHref(file.source, file.path),
    tags,
    shelf:
      file.source === 'wiki'
        ? wikiShelf(file.path, tags[0])
        : readwiseShelf(file.path),
    status: file.source === 'wiki' ? str(data.wiki_status) : undefined,
    updated: str(file.source === 'wiki' ? data.wiki_updated : data.updated),
    author: str(data.author),
    url:
      typeof data.url === 'string' && /^https?:\/\//i.test(data.url)
        ? data.url
        : undefined,
  };
  const prose = plainText(tree);
  const links = [...prose.matchAll(WIKILINK_PATTERN)].map((m) => m[1]);
  return { doc, file, prose, links };
}

/** Parsed files by path, so a rebuild after one file changes parses only that file. */
const parsed = new Map<string, { key: string; item: Indexed | null }>();

function indexFileCached(file: KbFile, config: KbConfig): Indexed | null {
  const key = `${file.mtimeMs}|${file.size}|${file.source}|${config.redact.join(',')}`;
  const hit = parsed.get(file.file);
  if (hit && hit.key === key) return hit.item;
  const item = indexFile(file, config);
  parsed.set(file.file, { key, item });
  return item;
}

export interface KbIndex {
  /** Visible documents, wiki first, each source in path order. */
  docs: KbDoc[];
  entries: KbEntry[];
  /** Whether each source's folder is mounted and readable. */
  mounted: Record<KbSource, boolean>;
  get(id: string): KbDoc | undefined;
  /** Visible documents that link to this one. */
  backlinks(id: string): KbDoc[];
  /** This document's resolved wikilinks, de-duplicated, in order. */
  outbound(id: string): ResolvedLink[];
  resolve(inner: string): ResolvedLink;
  /** Changes whenever the set of files or any file changes. */
  signature: string;
}

function lookupFor(
  docs: readonly KbDoc[],
  hiddenFiles: readonly KbFile[],
): KbLookup {
  // Obsidian matches names case-insensitively, macOS may store them decomposed, and a
  // Readwise title can end in a space that a wikilink's target loses.
  const key = (s: string) =>
    s
      .normalize('NFC')
      .toLowerCase()
      .split('/')
      .map((part) => part.trim())
      .join('/');
  const wiki = new Map<string, KbDoc>();
  const readwise = new Map<string, KbDoc>();
  const readwiseNames = new Map<string, KbDoc>();
  for (const doc of docs) {
    if (doc.source === 'wiki') wiki.set(key(doc.path), doc);
    else {
      readwise.set(key(doc.path), doc);
      const name = key(doc.path.split('/').pop() ?? doc.path);
      if (!readwiseNames.has(name)) readwiseNames.set(name, doc);
    }
  }
  // Names of files kept out, as a vault-root link would spell them, so a link to one is
  // withheld like a private note instead of showing the hidden page's name.
  const hidden = new Set(
    hiddenFiles.map((f) =>
      key(f.source === 'wiki' ? f.path : `readwise/${f.path}`),
    ),
  );
  for (const f of hiddenFiles)
    hidden.add(
      key(
        f.source === 'wiki'
          ? `pages/${f.path}`
          : (f.path.split('/').pop() ?? f.path),
      ),
    );
  return {
    wiki: (path) => wiki.get(key(path)),
    hidden: (target) => hidden.has(key(target)),
    readwise: (path) => readwise.get(key(path)),
    readwiseByName: (name) => readwiseNames.get(key(name)),
  };
}

function scanAll(config: KbConfig): {
  files: KbFile[];
  mounted: Record<KbSource, boolean>;
} {
  const mounted = { wiki: false, readwise: false };
  const files: KbFile[] = [];
  for (const source of ['wiki', 'readwise'] as const) {
    const found = scanRoot(source, config.roots[source]);
    mounted[source] = found !== null;
    if (found)
      files.push(...found.sort((a, b) => a.path.localeCompare(b.path)));
  }
  return { files, mounted };
}

/** Scans and indexes both roots from scratch. */
export function buildKbIndex(config: KbConfig): KbIndex {
  const { files, mounted } = scanAll(config);
  return indexFiles(files, mounted, config);
}

function signatureOf(files: readonly KbFile[]): string {
  return files.map((f) => `${f.file}:${f.mtimeMs}:${f.size}`).join('\n');
}

function indexFiles(
  files: KbFile[],
  mounted: Record<KbSource, boolean>,
  config: KbConfig,
): KbIndex {
  const indexed: Indexed[] = [];
  const hiddenFiles: KbFile[] = [];
  for (const f of files) {
    const item = indexFileCached(f, config);
    if (item) indexed.push(item);
    else hiddenFiles.push(f);
  }
  const docs = indexed.map((i) => i.doc);
  const nfc = (id: string) => id.normalize('NFC');
  const byId = new Map(indexed.map((i) => [nfc(i.doc.id), i]));
  const lookup = lookupFor(docs, hiddenFiles);
  const resolve = (inner: string) =>
    resolveWikilink(parseWikilink(inner), lookup, config.vault);

  const outbound = new Map<string, ResolvedLink[]>();
  const backlinks = new Map<string, Set<string>>();
  for (const item of indexed) {
    const seen = new Set<string>();
    const links: ResolvedLink[] = [];
    for (const inner of item.links) {
      const link = resolve(inner);
      const key =
        link.kind === 'kb'
          ? link.doc.id
          : `${link.kind}:${'href' in link ? link.href : link.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push(link);
      if (link.kind === 'kb' && link.doc.id !== item.doc.id) {
        const set = backlinks.get(nfc(link.doc.id)) ?? new Set();
        set.add(item.doc.id);
        backlinks.set(nfc(link.doc.id), set);
      }
    }
    outbound.set(nfc(item.doc.id), links);
  }

  return {
    docs,
    // The search reads what the page shows: each wikilink as its rendered label.
    entries: indexed.map((i) => ({
      doc: i.doc,
      text: i.prose.replace(
        WIKILINK_PATTERN,
        (_m, inner: string) => resolve(inner).label,
      ),
    })),
    mounted,
    get: (id) => byId.get(nfc(id))?.doc,
    backlinks: (id) =>
      [...(backlinks.get(nfc(id)) ?? [])]
        .flatMap((b) => byId.get(nfc(b))?.doc ?? [])
        .sort((a, b) => a.title.localeCompare(b.title)),
    outbound: (id) => outbound.get(nfc(id)) ?? [],
    resolve,
    signature: signatureOf(files),
  };
}

/** How long a scan stays fresh; the vault syncs through iCloud, so seconds are enough. */
const RESCAN_MS = 30_000;

let cached: { index: KbIndex; scannedAt: number; config: string } | undefined;

/**
 * The index, rebuilt when a file under either root was added, removed or changed. Scans are
 * cheap stats; files are parsed again only when the scan differs.
 */
export function getKbIndex(
  config: KbConfig = kbConfigFromEnv(),
  now = Date.now(),
): KbIndex {
  const configKey = JSON.stringify(config);
  if (
    cached &&
    cached.config === configKey &&
    now - cached.scannedAt < RESCAN_MS
  )
    return cached.index;
  const { files, mounted } = scanAll(config);
  const unchanged =
    cached?.config === configKey &&
    cached.index.signature === signatureOf(files) &&
    cached.index.mounted.wiki === mounted.wiki &&
    cached.index.mounted.readwise === mounted.readwise;
  const index =
    unchanged && cached ? cached.index : indexFiles(files, mounted, config);
  cached = { index, scannedAt: now, config: configKey };
  return index;
}

const rendered = new Map<string, { key: string; html: string }>();

/**
 * A visible document's body as sanitised HTML, or null when it is not visible. A file changed
 * since the last scan is read and checked again, so a page made private in between is not
 * served, from the cache or otherwise.
 */
export function renderKbDoc(
  index: KbIndex,
  id: string,
  config: KbConfig = kbConfigFromEnv(),
): string | null {
  const doc = index.get(id);
  if (!doc) return null;
  const file = join(config.roots[doc.source], `${doc.path}.md`);
  let key: string;
  try {
    const stat = statSync(file);
    key = `${index.signature}|${file}|${stat.mtimeMs}|${stat.size}`;
  } catch {
    return null;
  }
  const hit = rendered.get(id);
  if (hit && hit.key === key) return hit.html;

  let raw: string;
  try {
    raw = readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
  const fm = splitFrontmatter(raw);
  if (fm.invalid || isHiddenFrontmatter(fm.data)) return null;
  const { tree, company } = parseBody(fm.body, config.redact);
  if (company) return null;
  const html = renderTree(tree, index.resolve);
  rendered.set(id, { key, html });
  return html;
}
