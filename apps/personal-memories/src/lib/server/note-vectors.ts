import { noteDoc, type SearchDoc } from '@/lib/search';

import { type Embedder, embedderFromEnv } from './embed.ts';
import { type NotesStore, notesStore } from './notes-store.ts';

export const NOTE_BATCH = 16;

export type NoteVectors = {
  docs(): SearchDoc[];
  vector(id: string): Float32Array | undefined;
  refresh(date: string): Promise<void>;
  start(): Promise<void>;
};

export function noteVectors(
  store: NotesStore | undefined,
  embedder: Embedder,
): NoteVectors {
  const docs = new Map<string, SearchDoc>();
  const vectors = new Map<string, { hash: string; vector: Float32Array }>();

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
    start: async () => {
      if (!store) return;
      const loaded = [...store.dates()].sort().flatMap((d) => load(d) ?? []);
      await embedDocs(loaded);
    },
  };
}

let shared: NoteVectors | undefined;

export function getNoteVectors(): NoteVectors {
  if (!shared) {
    shared = noteVectors(notesStore(), embedderFromEnv());
    shared
      .start()
      .catch((error: unknown) =>
        console.error('[memories] note search index failed', error),
      );
  }
  return shared;
}
