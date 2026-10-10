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

export function photographerOf(
  people: readonly Person[],
  camera: string | undefined,
): Person | undefined {
  if (!camera) return undefined;
  const owners = people.filter((p) => p.devices?.includes(camera));
  return owners.length === 1 ? owners[0] : undefined;
}
