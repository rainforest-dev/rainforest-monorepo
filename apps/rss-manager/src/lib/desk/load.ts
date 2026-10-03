import type { ReadingQueue } from '@/lib/readingQueue';
import type { Source, Topic } from '@/lib/registry.types';

export type FileLoad<T> = { ok: true; data: T } | { ok: false; error: string };

export interface SourcesData {
  sources: Source[];
  writable: boolean;
  warnings: string[];
}

export interface TopicsData {
  topics: Topic[];
  writable: boolean;
  warnings: string[];
}

export type QueueData = ReadingQueue | null;

export interface DeskData {
  sources: FileLoad<SourcesData>;
  topics: FileLoad<TopicsData>;
  queue: FileLoad<QueueData>;
}

export type DeskFile = keyof DeskData;

export function loadFailure(err: unknown): { ok: false; error: string } {
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

async function getJson(endpoint: string): Promise<unknown> {
  const res = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
  });
  const body = (await res.json().catch(() => null)) as {
    error?: unknown;
  } | null;
  if (!res.ok || body === null) {
    throw new Error(
      typeof body?.error === 'string'
        ? body.error
        : `The server answered ${res.status}.`,
    );
  }
  return body;
}

async function load<T>(
  endpoint: string,
  toData: (body: unknown) => T,
): Promise<FileLoad<T>> {
  try {
    return { ok: true, data: toData(await getJson(endpoint)) };
  } catch (err) {
    return loadFailure(err);
  }
}

export const fetchSources = (): Promise<FileLoad<SourcesData>> =>
  load('/api/sources', (body) => body as SourcesData);

export const fetchTopics = (): Promise<FileLoad<TopicsData>> =>
  load('/api/topics', (body) => body as TopicsData);

export const fetchQueue = (): Promise<FileLoad<QueueData>> =>
  load('/api/reading-queue', (body) => {
    const queue = body as ReadingQueue | { generated: null };
    return queue.generated === null ? null : queue;
  });
