import { describe, expect, it, vi } from 'vitest';

import type { DayNote } from '@/lib/notes';

import { type Embedder, fakeEmbedder } from './embed.ts';
import { noteVectors } from './note-vectors.ts';
import type { NotesStore } from './notes-store.ts';
import { breaker, makeIndex, runSearch } from './search-index.ts';

const memoryStore = (bodies: Record<string, string>): NotesStore => ({
  root: '/notes',
  writable: false,
  read: (date) => ({
    note: {
      date,
      frontmatter: {},
      body: bodies[date] ?? '',
      annotations: [],
    } satisfies DayNote,
    version: `v-${bodies[date] ?? ''}`,
  }),
  write: () => {
    throw new Error('read-only stub');
  },
  dates: () => new Set(Object.keys(bodies)),
});

const counting = (inner: Embedder = fakeEmbedder()) => {
  const embed = vi.fn(inner.embed);
  return { embedder: { ...inner, embed }, embed };
};

describe('noteVectors', () => {
  it('makes every note searchable after start', async () => {
    const notes = noteVectors(
      memoryStore({ '2025-10-31': '今天吃了拉麵', '2025-11-01': '' }),
      fakeEmbedder(),
    );
    await notes.start();
    expect(notes.docs().map((d) => d.id)).toEqual(['note:2025-10-31']);
    expect(notes.vector('note:2025-10-31')).toBeInstanceOf(Float32Array);
  });

  it('keeps notes lexically searchable when the embedder fails', async () => {
    const notes = noteVectors(memoryStore({ '2025-10-31': '拉麵' }), {
      ...fakeEmbedder(),
      embed: async () => {
        throw new Error('ollama down');
      },
    });
    await expect(notes.start()).resolves.toBeUndefined();
    expect(notes.docs()).toHaveLength(1);
    expect(notes.vector('note:2025-10-31')).toBeUndefined();
  });

  it('re-embeds a changed note on refresh and leaves an unchanged one alone', async () => {
    const bodies = { '2025-10-31': '拉麵' };
    const { embedder, embed } = counting();
    const notes = noteVectors(memoryStore(bodies), embedder);
    await notes.start();
    await notes.refresh('2025-10-31');
    expect(embed).toHaveBeenCalledTimes(1);
    bodies['2025-10-31'] = '海邊';
    await notes.refresh('2025-10-31');
    expect(embed).toHaveBeenCalledTimes(2);
    expect(notes.docs()[0]?.text).toBe('海邊');
  });

  it('drops a note emptied by a save', async () => {
    const bodies = { '2025-10-31': '拉麵' };
    const notes = noteVectors(memoryStore(bodies), fakeEmbedder());
    await notes.start();
    bodies['2025-10-31'] = '';
    await notes.refresh('2025-10-31');
    expect(notes.docs()).toEqual([]);
    expect(notes.vector('note:2025-10-31')).toBeUndefined();
  });

  it('never serves a vector built from an older version of the note', async () => {
    const bodies = { '2025-10-31': '拉麵' };
    let release: () => void = () => undefined;
    const inner = fakeEmbedder();
    let calls = 0;
    const notes = noteVectors(memoryStore(bodies), {
      ...inner,
      embed: async (texts, kind) => {
        calls += 1;
        if (calls === 1) await new Promise<void>((r) => (release = r));
        return inner.embed(texts, kind);
      },
    });
    const starting = notes.start();
    await Promise.resolve();
    bodies['2025-10-31'] = '海邊';
    await notes.refresh('2025-10-31');
    release();
    await starting;
    const [sea] = await inner.embed(['海邊'], 'document');
    expect(notes.vector('note:2025-10-31')).toEqual(sea);
  });

  it('does nothing without a notes directory', async () => {
    const notes = noteVectors(undefined, fakeEmbedder());
    await notes.start();
    await notes.refresh('2025-10-31');
    expect(notes.docs()).toEqual([]);
  });
});

describe('runSearch with notes', () => {
  const searchWith = async (text: string) => {
    const notes = noteVectors(
      memoryStore({ '2025-10-31': '今天吃了拉麵' }),
      fakeEmbedder(),
    );
    await notes.start();
    const index = { ...makeIndex([]), extra: notes };
    return runSearch(index, { text }, fakeEmbedder(), breaker());
  };

  it('finds a note day by its words', async () => {
    const { results } = await searchWith('拉麵');
    expect(results.map((r) => [r.date, r.source])).toEqual([
      ['2025-10-31', 'note'],
    ]);
  });

  it('finds a note day by meaning through its vector', async () => {
    const { results, semantic } = await searchWith('noodle');
    expect(semantic).toBe('on');
    expect(results.map((r) => r.date)).toEqual(['2025-10-31']);
  });
});
