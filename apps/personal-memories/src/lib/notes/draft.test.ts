import { describe, expect, it } from 'vitest';

import type { ResolvedAnnotation } from './attach.ts';
import { applyStamps, saveInput, toDraft, withCover } from './draft.ts';
import type { NotePayload } from './payload.ts';

const annotation: ResolvedAnnotation = {
  eventId: 'e1',
  at: '2025-11-01T09:00:00+08:00',
  source: 'line',
  author: 'Alice',
  excerpt: 'hi',
  body: 'note',
  status: 'exact',
};

const payload: NotePayload = {
  date: '2025-11-01',
  body: '下雨',
  annotations: [annotation],
  cover: 'P1',
  version: 'v1',
  writable: true,
};

describe('draft', () => {
  it('carries the cover from the payload into the draft', () => {
    expect(toDraft(payload).cover).toBe('P1');
    expect(toDraft({ ...payload, cover: undefined }).cover).toBeUndefined();
  });

  it('saves the draft cover, not the payload one, and strips annotation status', () => {
    expect(saveInput(payload, withCover(toDraft(payload), 'P2'))).toEqual({
      date: '2025-11-01',
      body: '下雨',
      annotations: [
        {
          eventId: 'e1',
          at: annotation.at,
          source: 'line',
          author: 'Alice',
          excerpt: 'hi',
          body: 'note',
          origin: 'new',
        },
      ],
      cover: 'P2',
      version: 'v1',
    });
    expect(
      saveInput(payload, withCover(toDraft(payload), undefined)).cover,
    ).toBeUndefined();
  });

  it('keeps the annotation author when saving', () => {
    const signed = { ...payload, annotations: [{ ...annotation, by: 'Bob' }] };
    expect(saveInput(signed, toDraft(signed)).annotations[0]).toMatchObject({
      by: 'Bob',
    });
  });

  it('keeps the annotation origin when saving, and marks one without an origin as new', () => {
    const withOrigin = {
      ...payload,
      annotations: [{ ...annotation, origin: 'e1' }],
    };
    expect(
      saveInput(withOrigin, toDraft(withOrigin)).annotations[0],
    ).toMatchObject({ origin: 'e1' });
    expect(saveInput(payload, toDraft(payload)).annotations[0]?.origin).toBe(
      'new',
    );
  });
});

describe('applyStamps', () => {
  const second: ResolvedAnnotation = {
    ...annotation,
    eventId: 'e2',
    at: '2025-11-01T10:00:00+08:00',
  };
  const stamps = [
    { by: 'Alice', origin: 'e:e1' },
    { by: 'Bob', origin: 'e:e2' },
  ];

  it('stamps annotations the user kept typing into after the save was sent', () => {
    const typed = [
      { ...annotation, body: 'note, and more' },
      { ...second, body: 'later' },
    ];
    expect(applyStamps([annotation, second], typed, stamps)).toEqual([
      { ...typed[0], by: 'Alice', origin: 'e:e1' },
      { ...typed[1], by: 'Bob', origin: 'e:e2' },
    ]);
  });

  it('leaves a slot alone once a different annotation occupies it', () => {
    const third: ResolvedAnnotation = { ...annotation, eventId: 'e3' };
    const [first, replaced, added] = applyStamps(
      [annotation, second],
      [annotation, third, { ...second, eventId: 'e4' }],
      stamps,
    );
    expect(first).toMatchObject({ by: 'Alice', origin: 'e:e1' });
    expect(replaced).toBe(third);
    expect(added).not.toHaveProperty('origin');
  });

  it('does not sign a 眉批 re-added in the slot of a deleted one', () => {
    const stored = { ...annotation, by: 'Alice', origin: 'e:e1' };
    const readded = { ...annotation, body: 'mine now' };
    const [result] = applyStamps([stored], [readded], stamps.slice(0, 1));
    expect(result).toBe(readded);
  });
});
