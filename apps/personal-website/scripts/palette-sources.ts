import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getProjects,
  getSkills,
  getWorkExperience,
} from '@rainforest-dev/personal-data';
import fg from 'fast-glob';
import matter from 'gray-matter';

import { buildPaletteRecords } from '../src/utils/palette-records.ts';
import type { Searchable } from '../src/utils/search.ts';

export const EXPANSIONS_PATH = resolve(
  import.meta.dirname,
  '../src/data/search-expansions.json',
);
const BLOG_DIR = resolve(import.meta.dirname, '../src/data/blog');
const LANGS = ['en', 'zh'] as const;

export async function loadPaletteRecords(): Promise<Searchable[]> {
  const posts = fg
    .sync('**/*.{md,mdx}', { cwd: BLOG_DIR })
    .sort()
    .map((file) => {
      const { data } = matter(readFileSync(resolve(BLOG_DIR, file), 'utf8'));
      return {
        id: file.replace(/\.mdx?$/, ''),
        data: {
          title: String(data.title),
          tags: (data.tags ?? []) as string[],
        },
      };
    });
  const byId = new Map<string, Searchable>();
  for (const lang of LANGS) {
    const [experiences, projects, skills] = await Promise.all([
      getWorkExperience({ lang }),
      getProjects({ lang }),
      getSkills({ lang }),
    ]);
    for (const record of buildPaletteRecords({
      experiences,
      projects,
      skills,
      posts,
    }))
      byId.set(record.id, record);
  }
  return [...byId.values()];
}
