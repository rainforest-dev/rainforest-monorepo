// Drop-in replacement for astro:content's getCollection/getEntry, so this data
// (and the Zod schemas that validate it) can be consumed outside of Astro —
// e.g. by the personal-data MCP server — without pulling in the Astro runtime.
// See docs/superpowers/specs/2026-07-07-personal-mcp-split-design.md.
import * as fs from 'node:fs';
import * as path from 'node:path';

import fg from 'fast-glob';
import matter from 'gray-matter';
import { ZodError, type z } from 'zod';

import {
  experienceSchema,
  organizationSchema,
  projectSchema,
  skillSchema,
} from './schemas';

const DATA_ROOT = path.join(__dirname, 'data');

const schemas = {
  organizations: organizationSchema,
  experiences: experienceSchema,
  projects: projectSchema,
  skills: skillSchema,
} as const;

type CollectionName = keyof typeof schemas;

// Collections stored as one JSON file per entry rather than Markdown-with-frontmatter.
// Both getCollection (glob pattern selection) and readEntry (parse strategy) branch
// on this same fact, so it's centralized here rather than re-derived independently
// (e.g. via a `collection === 'organizations'` check and a `filePath.endsWith('.json')`
// check that could silently drift apart).
const JSON_COLLECTIONS = new Set<CollectionName>(['organizations']);

export interface Entry<Data> {
  id: string;
  data: Data;
  body: string;
}

type CollectionData<C extends CollectionName> = z.infer<(typeof schemas)[C]>;

function readEntry<C extends CollectionName>(collection: C, filePath: string): Entry<CollectionData<C>> {
  const collectionRoot = path.join(DATA_ROOT, collection);
  const id = path
    .relative(collectionRoot, filePath)
    .replace(/\.(md|json)$/, '')
    .split(path.sep)
    .join('/');
  const schema = schemas[collection];

  try {
    if (JSON_COLLECTIONS.has(collection)) {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return { id, data: schema.parse(raw) as CollectionData<C>, body: '' };
    }

    const { data, content } = matter(fs.readFileSync(filePath, 'utf-8'));
    return { id, data: schema.parse(data) as CollectionData<C>, body: content.trim() };
  } catch (err) {
    if (err instanceof ZodError) {
      throw new Error(`Invalid content in ${filePath} (id: ${id}): ${err.message}`);
    }
    throw err;
  }
}

export async function getCollection<C extends CollectionName>(
  collection: C,
  filter?: (entry: Entry<CollectionData<C>>) => boolean,
): Promise<Entry<CollectionData<C>>[]> {
  const collectionRoot = path.join(DATA_ROOT, collection);
  const pattern = JSON_COLLECTIONS.has(collection) ? '**/*.json' : '**/*.md';
  const files = fg.sync(pattern, { cwd: collectionRoot, absolute: true });
  const entries = files.map((file) => readEntry(collection, file));
  return filter ? entries.filter(filter) : entries;
}

export async function getEntry<C extends CollectionName>(
  collection: C,
  id: string,
): Promise<Entry<CollectionData<C>> | undefined> {
  const entries = await getCollection(collection);
  return entries.find((entry) => entry.id === id);
}
