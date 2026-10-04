import { noteDoc, type SearchDoc } from '@/lib/search';

import { type Embedder, sharedEmbedders } from './embed.ts';
import { type NotesStore, notesStore } from './notes-store.ts';

export const NOTE_BATCH = 8;
export const NOTE_SYNC_MS = 30_000;

export type NoteVectors = {
  docs(): SearchDoc[];
  vector(id: string): Float32Array | undefined;
  refresh(date: string): Promise<void>;
  start(): Promise<void>;
  sync(): Promise<void>;
  syncIfStale(now: number): void;
};

export function noteVectors(
  store: NotesStore | undefined,
  embedder: Embedder,
): NoteVectors {
  const docs = new Map<string, SearchDoc>();
  const vectors = new Map<string, { hash: string; vector: Float32Array }>();
  let lastSync = -Infinity;
  let embedding: Promise<void> | undefined;

  const load = (date: string) => {
    const read = store?.read(date);
    const doc =
      read && !read.parseError
        ? noteDoc(date, read.note.body, read.note.annotations)
        : undefined;
    if (doc) docs.set(doc.id, doc);
    else {
      docs.delete(`note:${date}`);
      vectors.delete(`note:${date}`);
    }
    return doc;
  };

  const readAll = (): SearchDoc[] => {
    if (!store) return [];
    let dates: Set<string>;
    try {
      dates = store.dates();
    } catch (error) {
      console.error('[memories] cannot list notes', error);
      return [];
    }
    for (const doc of [...docs.values()])
      if (!dates.has(doc.day)) {
        docs.delete(doc.id);
        vectors.delete(doc.id);
      }
    return [...dates].sort().flatMap((date) => {
      try {
        return load(date) ?? [];
      } catch (error) {
        console.error(`[memories] cannot read the note for ${date}`, error);
        return [];
      }
    });
  };

  const embedDocs = async (batch: SearchDoc[]) => {
    const pending = batch.filter(
      (d) => vectors.get(d.id)?.hash !== d.contentHash,
    );
    for (let i = 0; i < pending.length; i += NOTE_BATCH) {
      const slice = pending.slice(i, i + NOTE_BATCH);
      const out = await embedder
        .embed(
          slice.map((d) => d.text),
          'document',
        )
        .catch(() => undefined);
      slice.forEach((d, j) => {
        const vector = out?.[j];
        if (
          vector?.length === embedder.dims &&
          docs.get(d.id)?.contentHash === d.contentHash
        )
          vectors.set(d.id, { hash: d.contentHash, vector });
      });
    }
  };

  const sync = async () => {
    await embedDocs(readAll());
  };

  return {
    docs: () => [...docs.values()],
    vector: (id) => {
      const entry = vectors.get(id);
      return entry && entry.hash === docs.get(id)?.contentHash
        ? entry.vector
        : undefined;
    },
    refresh: async (date) => {
      if (!store) return;
      const doc = load(date);
      if (doc) await embedDocs([doc]);
    },
    start: sync,
    sync,
    syncIfStale: (now) => {
      if (now - lastSync < NOTE_SYNC_MS) return;
      lastSync = now;
      const loaded = readAll();
      embedding ??= embedDocs(loaded).finally(() => {
        embedding = undefined;
      });
    },
  };
}

let shared: NoteVectors | undefined;

export const getNoteVectors = (): NoteVectors =>
  (shared ??= noteVectors(notesStore(), sharedEmbedders().background));
