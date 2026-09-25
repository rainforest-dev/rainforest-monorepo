import { describe, expect, it } from 'vitest';

import type { ResolvedAnnotation } from './attach.ts';
import { saveInput, toDraft, withCover } from './draft.ts';
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
});
