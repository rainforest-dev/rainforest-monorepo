import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';

import { db, notebookPages } from '@/db';
import { pagePng, setUpNotebookShelf } from '@/test';

import { notebookHallItems, notebookTopics } from './hall-items';
import { appendPages, createNotebook, reorderPages } from './notebooks';

describe('notebookTopics', () => {
  it('reads #tags, most used first, ties in writing order', () => {
    expect(
      notebookTopics([
        '# Monday\n- #travel to 台南 #家人',
        null,
        '#家人 dinner, #photo',
        '#家人',
      ]),
    ).toEqual(['家人', 'travel', 'photo']);
  });

  it('skips headings, numbers, C# and URL fragments', () => {
    expect(
      notebookTopics(['## Title', 'page #3', 'C# notes', 'see a.test/x#top']),
    ).toEqual([]);
  });

  it('counts a tag in any case under its first spelling', () => {
    expect(notebookTopics(['#Obsidian', '#obsidian #ai', '#OBSIDIAN'])).toEqual(
      ['Obsidian', 'ai'],
    );
  });

  it('stops a tag at punctuation and keeps a nested one whole', () => {
    expect(notebookTopics(['寫完 #閱讀。', '#tech/react, ok'])).toEqual([
      '閱讀',
      'tech/react',
    ]);
  });
});

describe('notebookHallItems', () => {
  beforeAll(() => {
    setUpNotebookShelf('notebook-hall-items-');
  });

  it("sends the #tags on a notebook's pages as its topics", async () => {
    const { id } = await createNotebook('Hall topics 2026-08');
    const { added } = await appendPages(id, [
      { name: 'a.png', type: 'image/png', bytes: await pagePng(11) },
      { name: 'b.png', type: 'image/png', bytes: await pagePng(23) },
    ]);
    const transcriptions = ['#garden plan', 'more #garden, #rain'];
    added.forEach((pageId, i) =>
      db
        .update(notebookPages)
        .set({ transcription: transcriptions[i] })
        .where(eq(notebookPages.id, pageId))
        .run(),
    );
    const untagged = await createNotebook('Hall no topics');

    const items = await notebookHallItems();
    const groups = (nid: number) =>
      items.find((item) => item.id === String(nid))?.groups;
    expect(groups(id)).toEqual(
      expect.arrayContaining(['topic:garden', 'topic:rain']),
    );
    expect(groups(id)?.find((g) => g.startsWith('topic:'))).toBe(
      'topic:garden',
    );
    expect(groups(untagged.id)?.some((g) => g.startsWith('topic:'))).toBe(
      false,
    );
  });

  it('breaks a tie between two tags by page order, not by when a page was added', async () => {
    const { id } = await createNotebook('Hall topic tie');
    const { added } = await appendPages(id, [
      { name: 'c.png', type: 'image/png', bytes: await pagePng(31) },
      { name: 'd.png', type: 'image/png', bytes: await pagePng(47) },
    ]);
    const [first = 0, second = 0] = added;
    db.update(notebookPages)
      .set({ transcription: '#rain' })
      .where(eq(notebookPages.id, first))
      .run();
    db.update(notebookPages)
      .set({ transcription: '#garden' })
      .where(eq(notebookPages.id, second))
      .run();
    // The page added last now comes first, so its tag was written first.
    await reorderPages(id, [second, first]);

    const item = (await notebookHallItems()).find(
      (entry) => entry.id === String(id),
    );
    expect(item?.groups.filter((g) => g.startsWith('topic:'))).toEqual([
      'topic:garden',
      'topic:rain',
    ]);
  });
});
