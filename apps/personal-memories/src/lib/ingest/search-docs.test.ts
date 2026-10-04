import { describe, expect, it } from 'vitest';

import type { Person } from '../people.ts';
import type { TimelineEvent } from '../server/timeline.ts';
import {
  buildSearchDocs,
  chatDocs,
  CHUNK_MAX_CHARS,
  CHUNK_MAX_MESSAGES,
  photoDocs,
} from './search-docs.ts';

const PEOPLE: Person[] = [
  { id: 'bob', name: 'Bob', aliases: { line: ['Bobby'], photo: ['Robert'] } },
];

const at = (minutes: number) =>
  new Date(Date.UTC(2025, 10, 1, 1, 0) + minutes * 60_000)
    .toISOString()
    .replace('.000Z', '+00:00');

const msg = (
  id: string,
  minutes: number,
  text: string,
  extra: Partial<TimelineEvent> = {},
): TimelineEvent => ({
  id,
  source: 'line',
  at: at(minutes),
  author: 'Bobby',
  text,
  ...extra,
});

describe('chatDocs', () => {
  it('joins messages less than 10 minutes apart and splits after a longer gap', () => {
    const docs = chatDocs(
      [msg('a', 0, '早'), msg('b', 9, '吃麵'), msg('c', 20, '晚安')],
      PEOPLE,
    );
    expect(docs.map((d) => d.eventIds)).toEqual([['a', 'b'], ['c']]);
  });

  it('writes one line per message with the time and display name', () => {
    const [doc] = chatDocs([msg('a', 0, '台南的拉麵')], PEOPLE);
    expect(doc).toMatchObject({
      id: 'chat:a',
      day: '2025-11-01',
      kind: 'chat',
      source: 'line',
      text: '09:00 Bob：台南的拉麵',
      snippet: '台南的拉麵',
      people: ['bob'],
    });
  });

  it('starts a new chunk at the message and character limits', () => {
    const many = Array.from({ length: CHUNK_MAX_MESSAGES + 1 }, (_, i) =>
      msg(`m${i}`, 0, 'hi'),
    );
    expect(chatDocs(many, PEOPLE).map((d) => d.eventIds.length)).toEqual([
      CHUNK_MAX_MESSAGES,
      1,
    ]);
    const long = 'x'.repeat(CHUNK_MAX_CHARS - 10);
    expect(
      chatDocs([msg('l1', 0, long), msg('l2', 1, long)], PEOPLE).length,
    ).toBe(2);
  });

  it('keeps two chats active in the same minutes apart', () => {
    const docs = chatDocs(
      [
        msg('a', 0, 'one', { chat: 'family' }),
        msg('b', 1, 'two', { chat: 'work' }),
      ],
      PEOPLE,
    );
    expect(docs.map((d) => d.eventIds)).toEqual([['a'], ['b']]);
  });

  it('keeps sources apart', () => {
    const docs = chatDocs(
      [msg('a', 0, 'line'), msg('b', 1, 'slack', { source: 'slack' })],
      PEOPLE,
    );
    expect(docs.map((d) => d.source)).toEqual(['line', 'slack']);
  });

  it('skips photos and messages without text', () => {
    expect(
      chatDocs(
        [msg('a', 0, ''), msg('p', 1, 'x', { source: 'photo' })],
        PEOPLE,
      ),
    ).toEqual([]);
  });
});

describe('photoDocs', () => {
  it('writes the metadata in a fixed order and leaves out absent parts', () => {
    const [doc] = photoDocs(
      [
        {
          id: 'P1',
          source: 'photo',
          at: at(0),
          author: 'photo',
          text: 'Weekend',
          photo: {
            favorite: false,
            people: 1,
            screenshot: false,
            movie: false,
            burstPick: true,
            meta: {
              labels: ['Ramen', 'Food'],
              place: 'Tainan',
              venues: ['Noodle Bar'],
              persons: ['Robert'],
            },
          },
        },
      ],
      PEOPLE,
    );
    expect(doc).toMatchObject({
      id: 'photo:P1',
      kind: 'photo',
      text: 'labels: Ramen, Food｜場所: Noodle Bar｜地點: Tainan｜人物: Robert｜相簿: Weekend',
      people: ['bob'],
      places: ['Tainan', 'Noodle Bar'],
    });
  });
});

describe('buildSearchDocs', () => {
  it('builds chat and photo docs together', () => {
    const docs = buildSearchDocs([msg('a', 0, 'hi')], PEOPLE);
    expect(docs.map((d) => d.id)).toEqual(['chat:a']);
  });
});
