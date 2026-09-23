import { describe, expect, it } from 'vitest';

import { emptyNote, isEmptyNote, parseNote, serializeNote } from './format.ts';
import type { DayNote } from './types.ts';

const NOTE: DayNote = {
  date: '2025-11-01',
  frontmatter: { aliases: ['那個週末'], tags: ['memories', 'trip'] },
  body: '那天下雨。\n\n第二段。',
  cover: 'AAAAAAAA-0000-0000-0000-000000000001',
  annotations: [
    {
      eventId: '3fa9c1d2',
      at: '2025-11-01T09:05:00+08:00',
      source: 'line',
      author: 'Alice 🌷',
      excerpt: '"Lunch plan: 1. noodles…',
      body: '後來那家店關了。\n\n可惜。',
    },
    {
      eventId: 'AAAAAAAA-0000-0000-0000-000000000001',
      at: '2025-11-01T10:15:00+08:00',
      source: 'photo',
      author: 'photo',
      excerpt: 'Weekend, Food',
      body: '這張拍得最好',
    },
  ],
};

describe('serializeNote', () => {
  it('writes the documented layout', () => {
    expect(serializeNote(NOTE)).toBe(
      [
        '---',
        'date: 2025-11-01',
        "daily: '[[daily-notes/2025-11-01]]'",
        'tags:',
        '  - memories',
        '  - trip',
        'aliases:',
        '  - 那個週末',
        'cover: AAAAAAAA-0000-0000-0000-000000000001',
        '---',
        '',
        '那天下雨。',
        '',
        '第二段。',
        '',
        '## 眉批',
        '',
        '### 09:05 · LINE · Alice 🌷',
        '',
        '> "Lunch plan: 1. noodles…',
        '',
        '%% ev:3fa9c1d2 at:2025-11-01T09:05:00+08:00 src:line %%',
        '',
        '後來那家店關了。',
        '',
        '可惜。',
        '',
        '### 10:15 · 照片 · photo',
        '',
        '> Weekend, Food',
        '',
        '%% ev:AAAAAAAA-0000-0000-0000-000000000001 at:2025-11-01T10:15:00+08:00 src:photo %%',
        '',
        '這張拍得最好',
        '',
      ].join('\n'),
    );
  });

  it('adds the memories tag when missing', () => {
    const text = serializeNote({ ...NOTE, frontmatter: {}, annotations: [] });
    expect(text).toContain('tags:\n  - memories\n');
    expect(text).not.toContain('## 眉批');
  });
});

describe('parseNote', () => {
  it('round-trips', () => {
    const text = serializeNote(NOTE);
    expect(parseNote(text, '2025-11-01')).toEqual({
      ...NOTE,
      frontmatter: {
        date: '2025-11-01',
        daily: '[[daily-notes/2025-11-01]]',
        tags: ['memories', 'trip'],
        aliases: ['那個週末'],
      },
    });
    expect(serializeNote(parseNote(text, '2025-11-01'))).toBe(text);
  });

  it('keeps a hand-written body with its own headings', () => {
    const text = '---\ndate: 2025-11-01\n---\n\n## 早上\n\n醒得很早\n';
    const note = parseNote(text, '2025-11-01');
    expect(note.body).toBe('## 早上\n\n醒得很早');
    expect(note.annotations).toEqual([]);
  });

  it('reads an annotation without an anchor as unattached', () => {
    const text =
      '---\ndate: 2025-11-01\n---\n\n## 眉批\n\n### 手寫的\n\n隨手記\n';
    const [annotation] = parseNote(text, '2025-11-01').annotations;
    expect(annotation.eventId).toBe('');
    expect(annotation.author).toBe('手寫的');
    expect(annotation.body).toBe('隨手記');
  });

  it('round-trips a hand-written annotation without losing its heading', () => {
    const text =
      '---\ndate: 2025-11-01\n---\n\n## 眉批\n\n### 手寫的\n\n隨手記\n';
    const note = parseNote(text, '2025-11-01');
    const serialized = serializeNote(note);
    expect(serialized).toContain('### 手寫的');
    expect(serialized).toContain('隨手記');
    const reparsed = parseNote(serialized, '2025-11-01');
    expect(reparsed.annotations).toEqual(note.annotations);
    expect(serializeNote(reparsed)).toBe(serialized);
  });

  it('parses text without frontmatter', () => {
    const note = parseNote('只有正文', '2025-11-01');
    expect(note.frontmatter).toEqual({});
    expect(note.body).toBe('只有正文');
  });
});

describe('isEmptyNote', () => {
  it('is empty only with no body, annotations or cover', () => {
    expect(isEmptyNote(emptyNote('2025-11-01'))).toBe(true);
    expect(isEmptyNote({ body: ' \n', annotations: [] })).toBe(true);
    expect(isEmptyNote({ body: '', annotations: [], cover: 'X' })).toBe(false);
  });
});
