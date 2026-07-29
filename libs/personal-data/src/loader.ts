// Drop-in replacement for astro:content's getCollection/getEntry, so this data
// (and the Zod schemas that validate it) can be consumed outside of Astro —
// e.g. by the personal-data MCP server — without pulling in the Astro runtime.
// See docs/superpowers/specs/2026-07-07-personal-mcp-split-design.md.
// `/v4` to match ./schemas.ts — see the comment on its import. The `instanceof ZodError`
// check below only catches errors thrown by schemas built from the *same* namespace.
import { type z, ZodError } from 'zod/v4';

import {
  experienceSchema,
  organizationSchema,
  projectSchema,
  skillSchema,
} from './schemas';

const schemas = {
  organizations: organizationSchema,
  experiences: experienceSchema,
  projects: projectSchema,
  skills: skillSchema,
} as const;

type CollectionName = keyof typeof schemas;

// Collections stored as one JSON file per entry rather than Markdown-with-frontmatter.
// Both the raw-file maps below (JSON vs. markdown glob) and parseEntry (parse strategy)
// branch on this same fact, so it's centralized here rather than re-derived independently.
const JSON_COLLECTIONS = new Set<CollectionName>(['organizations']);

export interface Entry<Data> {
  id: string;
  data: Data;
  body: string;
}

type CollectionData<C extends CollectionName> = z.infer<(typeof schemas)[C]>;

// Each entry's file content is read and inlined by Vite at BUILD time (`eager`), so the
// resulting values live directly in this module's compiled output — unlike a runtime
// `fs.readFileSync` relative to `import.meta.url`, this doesn't care where the built module
// ends up on disk. That matters because this library gets consumed two different ways:
// bundled by its own `vite.config.ts` into `dist/index.js`, and re-bundled by consumers' own
// bundlers (e.g. Astro's Vite pipeline for the MCP API route), which may relocate the compiled
// code arbitrarily. A runtime file read also silently returns nothing on Vercel: the data
// files aren't statically imported anywhere, so Vercel's Node file-tracer (which decides what
// ships with a deployed serverless function) never includes them — `fg.sync` against a missing
// directory doesn't throw, it just returns `[]`, which is why the bug presented as empty
// collections rather than a crash. Inlining the content as literal values sidesteps
// file-tracing entirely: there's no file to trace, it's already part of the JS.
//
// `import.meta.glob`'s pattern *and options* must be written as literals inline at
// each call site (Vite statically parses this expression at compile time — a pattern
// or options object passed in via a shared variable isn't recognized), so this is one
// call per collection rather than a parameterized helper.

// organizations are JSON, not Markdown-with-frontmatter — no gray-matter involved, so these
// stay raw strings, `JSON.parse`'d per entry in parseEntry below.
const rawJsonFilesByCollection: Record<
  'organizations',
  Record<string, string>
> = {
  organizations: import.meta.glob('./data/organizations/**/*.json', {
    eager: true,
    query: '?raw',
    import: 'default',
  }) as Record<string, string>,
};

// A file imported with this raw string as a JS module's default export, produced by the
// `?frontmatter` Vite plugin (see vite.config.ts): gray-matter's parse of a markdown file's
// frontmatter fence and body, run in Node at build time rather than at runtime — gray-matter
// needs Buffer, which browsers don't have. `data` is `unknown` here (not yet schema-validated);
// parseEntry below runs it through the collection's Zod schema.
interface ParsedMarkdown {
  data: unknown;
  content: string;
}

type MarkdownCollectionName = Exclude<CollectionName, 'organizations'>;

const parsedMarkdownFilesByCollection: Record<
  MarkdownCollectionName,
  Record<string, ParsedMarkdown>
> = {
  experiences: import.meta.glob('./data/experiences/**/*.md', {
    eager: true,
    query: '?frontmatter',
    import: 'default',
  }) as Record<string, ParsedMarkdown>,
  projects: import.meta.glob('./data/projects/**/*.md', {
    eager: true,
    query: '?frontmatter',
    import: 'default',
  }) as Record<string, ParsedMarkdown>,
  skills: import.meta.glob('./data/skills/**/*.md', {
    eager: true,
    query: '?frontmatter',
    import: 'default',
  }) as Record<string, ParsedMarkdown>,
};

function idFromPath(collection: CollectionName, filePath: string): string {
  const prefix = `./data/${collection}/`;
  return filePath.slice(prefix.length).replace(/\.(md|json)$/, '');
}

/**
 * Parses one file's content into an `Entry`, wrapping schema-validation failures
 * with the offending file's path/id. Exported (rather than folded into getCollection)
 * so validation-error behavior is testable directly against fabricated content,
 * independent of the eager globs above — those are resolved once, at import time,
 * against whatever files exist on disk at build time, so a test can't inject a bad
 * file into them at runtime the way it could with the old fs-per-call reader.
 *
 * `raw` is a JSON string for JSON collections (still parsed here, at runtime — no
 * gray-matter/Buffer involved) or an already-frontmatter-parsed `{ data, content }` for
 * Markdown collections (parsed at build time by the `?frontmatter` Vite plugin; see
 * vite.config.ts and the glob definitions above).
 */
export function parseEntry<C extends CollectionName>(
  collection: C,
  filePath: string,
  raw: string | ParsedMarkdown,
): Entry<CollectionData<C>> {
  const id = idFromPath(collection, filePath);
  const schema = schemas[collection];
  try {
    if (JSON_COLLECTIONS.has(collection)) {
      return {
        id,
        data: schema.parse(JSON.parse(raw as string)) as CollectionData<C>,
        body: '',
      };
    }
    const { data, content } = raw as ParsedMarkdown;
    return {
      id,
      data: schema.parse(data) as CollectionData<C>,
      body: content.trim(),
    };
  } catch (err) {
    if (err instanceof ZodError) {
      throw new Error(
        `Invalid content in ${filePath} (id: ${id}): ${err.message}`,
      );
    }
    throw err;
  }
}

export async function getCollection<C extends CollectionName>(
  collection: C,
  filter?: (entry: Entry<CollectionData<C>>) => boolean,
): Promise<Entry<CollectionData<C>>[]> {
  const files: Record<string, string | ParsedMarkdown> = JSON_COLLECTIONS.has(
    collection,
  )
    ? rawJsonFilesByCollection[collection as 'organizations']
    : parsedMarkdownFilesByCollection[collection as MarkdownCollectionName];
  const entries = Object.entries(files).map(([filePath, raw]) =>
    parseEntry(collection, filePath, raw),
  );
  return filter ? entries.filter(filter) : entries;
}

export async function getEntry<C extends CollectionName>(
  collection: C,
  id: string,
): Promise<Entry<CollectionData<C>> | undefined> {
  const entries = await getCollection(collection);
  return entries.find((entry) => entry.id === id);
}
