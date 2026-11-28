import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { z } from 'astro/zod';

import { IDENTITY_HEADER } from '@/lib/notes';
import {
  applyPatch,
  EMOTION_IDS,
  emptyOrbs,
  ISLAND_IDS,
  type OrbPatch,
  type OrbsFile,
  parseOrbKey,
} from '@/lib/orbs.ts';

import type { PeopleConfig } from './people-store.ts';

const pickSchema = z.object({
  emotion: z.enum(EMOTION_IDS).optional(),
  island: z.enum(ISLAND_IDS).optional(),
  core: z.literal(true).optional(),
  at: z.string(),
});

const fileSchema = z.object({
  version: z.literal(1),
  orbs: z.record(
    z.string().refine((k) => !!parseOrbKey(k), 'unknown orb key'),
    z.record(z.string().min(1), pickSchema),
  ),
});

export type OrbsStore = {
  readonly path: string;
  readonly writable: boolean;
  read(): OrbsFile;
  update(key: string, personId: string, patch: OrbPatch): OrbsFile;
};

function canWrite(dir: string) {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function createOrbsStore(
  dir: string,
  now: () => Date = () => new Date(),
): OrbsStore {
  const path = join(dir, 'orbs.json');
  let cache: { sig: string; file: OrbsFile } | undefined;

  const read = (): OrbsFile => {
    if (!existsSync(path)) return emptyOrbs();
    const stats = statSync(path);
    const sig = `${stats.mtimeMs}:${stats.size}`;
    if (cache?.sig === sig) return cache.file;
    const file = fileSchema.parse(
      JSON.parse(readFileSync(path, 'utf8')),
    ) as OrbsFile;
    cache = { sig, file };
    return file;
  };

  return {
    path,
    writable: canWrite(dir),
    read,
    update(key, personId, patch) {
      if (!parseOrbKey(key)) throw new Error(`invalid orb key ${key}`);
      const next = applyPatch(
        read(),
        key,
        personId,
        patch,
        now().toISOString(),
      );
      const tmp = `${path}.${process.pid}.tmp`;
      writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
      renameSync(tmp, path);
      cache = undefined;
      return next;
    },
  };
}

let cached: OrbsStore | undefined;

export function orbsStore(): OrbsStore | undefined {
  const dir = process.env['MEMORIES_V2_DIR'];
  if (!dir) return undefined;
  if (cached?.path !== join(dir, 'orbs.json')) cached = createOrbsStore(dir);
  return cached;
}

export const readOrbs = (): OrbsFile => orbsStore()?.read() ?? emptyOrbs();

export type OrbPerson = { id: string; name: string; color: string };

export function orbPair(
  config: PeopleConfig,
  colors: readonly string[],
): OrbPerson[] {
  const ordered = [...config.people].sort(
    (a, b) =>
      Number(config.owners.has(b.name)) - Number(config.owners.has(a.name)),
  );
  return ordered.slice(0, 2).map((p, i) => ({
    id: p.id,
    name: p.name,
    color: colors[i] ?? colors[0] ?? 'currentColor',
  }));
}

export function viewerId(
  headers: Headers,
  config: PeopleConfig,
): string | undefined {
  const email = headers.get(IDENTITY_HEADER)?.trim().toLowerCase();
  return email
    ? config.people.find((p) => p.emails.includes(email))?.id
    : undefined;
}

export const isInsideOut = () => process.env['MEMORIES_UI'] === 'inside-out';
