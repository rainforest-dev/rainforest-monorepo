import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'astro/zod';

import { parseAuthors } from '@/lib/notes';
import type { Person } from '@/lib/people';

import { dataDir } from './store.ts';

export type ConfiguredPerson = Person & { emails: string[] };

export type PeopleConfig = {
  people: ConfiguredPerson[];
  owners: ReadonlySet<string>;
};

const names = z.array(z.string().trim().min(1)).optional();

const fileSchema = z
  .object({
    owner: z.string().optional(),
    people: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(40),
        emails: z
          .array(z.email().transform((e) => e.toLowerCase()))
          .default([]),
        aliases: z
          .object({ line: names, slack: names, photo: names })
          .default({}),
      }),
    ),
  })
  .superRefine((file, ctx) => {
    const claimed = new Map<string, string>();
    const claim = (key: string, label: string, id: string) => {
      const by = claimed.get(key);
      if (by !== undefined && by !== id)
        ctx.addIssue({
          code: 'custom',
          message: `${label} is claimed by both ${by} and ${id}`,
        });
      claimed.set(key, id);
    };
    const ids = new Set<string>();
    for (const p of file.people) {
      if (ids.has(p.id))
        ctx.addIssue({ code: 'custom', message: `duplicate id ${p.id}` });
      ids.add(p.id);
      for (const email of p.emails) claim(`email:${email}`, email, p.id);
      for (const [source, list] of Object.entries(p.aliases))
        for (const alias of [p.name, ...(list ?? [])])
          claim(`${source}:${alias}`, alias, p.id);
    }
    if (file.owner !== undefined && !ids.has(file.owner))
      ctx.addIssue({
        code: 'custom',
        message: `owner ${file.owner} is not in people`,
      });
  });

export function parsePeople(json: unknown): PeopleConfig {
  const file = fileSchema.parse(json);
  const people = file.people.map(({ aliases, ...p }) => ({
    ...p,
    aliases: Object.fromEntries(
      Object.entries(aliases).filter(([, list]) => list?.length),
    ),
  }));
  const owner = people.find((p) => p.id === file.owner);
  return { people, owners: new Set(owner ? [owner.name] : []) };
}

function legacyPeople(env: Record<string, string | undefined>): PeopleConfig {
  const people = [...parseAuthors(env['MEMORIES_AUTHORS'])].map(
    ([email, name]) => ({ id: name, name, emails: [email], aliases: {} }),
  );
  const owners = (env['MEMORIES_OWNER'] ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  return { people, owners: new Set(owners) };
}

export function loadPeople(
  root: string | undefined,
  env: Record<string, string | undefined> = process.env,
): PeopleConfig {
  const path = root && join(root, 'people.json');
  if (!path || !existsSync(path)) return legacyPeople(env);
  return parsePeople(JSON.parse(readFileSync(path, 'utf8')));
}

let cached: PeopleConfig | undefined;

export function getPeople(): PeopleConfig {
  const root = dataDir();
  if (root && existsSync(join(root, 'people.json')))
    return (cached ??= loadPeople(root));
  return loadPeople(undefined);
}

export const publicPeople = (config: PeopleConfig): Person[] =>
  config.people.map(({ id, name, aliases }) => ({ id, name, aliases }));
