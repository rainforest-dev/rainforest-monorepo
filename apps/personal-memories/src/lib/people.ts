import type { TimelineSource } from '@/lib/server';

export type Person = {
  id: string;
  name: string;
  aliases: Partial<Record<TimelineSource, string[]>>;
  devices?: string[];
};

export function personOf(
  people: readonly Person[],
  source: TimelineSource,
  raw: string,
): Person | undefined {
  return people.find(
    (p) => p.name === raw || (p.aliases[source] ?? []).includes(raw),
  );
}

export const nameOf = (
  people: readonly Person[],
  source: TimelineSource,
  raw: string,
) => personOf(people, source, raw)?.name ?? raw;

export const photographerOf = (
  people: readonly Person[],
  camera: string | undefined,
) => (camera ? people.find((p) => p.devices?.includes(camera)) : undefined);
