import { describe, expect, it } from 'vitest';

import {
  cleanName,
  parseAuthors,
  stampAuthors,
  viewerName,
} from './authors.ts';

const HEADER = 'Cf-Access-Authenticated-User-Email';

describe('parseAuthors', () => {
  it('maps lower-cased emails to cleaned names and skips junk', () => {
    const map = parseAuthors(
      ' Alice@Example.com = Alice , bob@example.com=Bob 🌷,broken,=x,carol@example.com=',
    );
    expect([...map]).toEqual([
      ['alice@example.com', 'Alice'],
      ['bob@example.com', 'Bob 🌷'],
    ]);
    expect(parseAuthors(undefined).size).toBe(0);
  });
});

describe('viewerName', () => {
  const env = { MEMORIES_AUTHORS: 'alice@example.com=Alice' };

  it('resolves the Access email header through the mapping', () => {
    expect(
      viewerName(new Headers({ [HEADER]: 'ALICE@example.com' }), env),
    ).toBe('Alice');
  });

  it('is undefined without a header, for an unknown email, or with no mapping', () => {
    expect(viewerName(new Headers(), env)).toBeUndefined();
    expect(
      viewerName(new Headers({ [HEADER]: 'eve@example.com' }), env),
    ).toBeUndefined();
    expect(
      viewerName(new Headers({ [HEADER]: 'alice@example.com' }), {}),
    ).toBeUndefined();
  });
});

describe('cleanName', () => {
  it('removes what would break the anchor comment', () => {
    expect(cleanName('Eve %% x\ny ')).toBe('Eve x y');
    expect(cleanName('x'.repeat(50))).toHaveLength(40);
  });
});

describe('stampAuthors', () => {
  const ann = (
    eventId: string,
    extra: { by?: string; excerpt?: string } = {},
  ) => ({
    eventId,
    at: '2025-11-01T09:00:00+08:00',
    source: 'line' as const,
    author: 'Alice',
    excerpt: eventId,
    ...extra,
  });

  it('signs only the annotations that are new in this save', () => {
    const [old, added] = stampAuthors(
      [ann('old'), ann('new')],
      [ann('old')],
      'Bob',
    );
    expect(old && 'by' in old).toBe(false);
    expect(added?.by).toBe('Bob');
  });

  it('leaves a legacy unsigned annotation unsigned when another user saves', () => {
    const [legacy] = stampAuthors([ann('legacy')], [ann('legacy')], 'Bob');
    expect(legacy && 'by' in legacy).toBe(false);
  });

  it('keeps the stored author even if the client sends another', () => {
    const [kept] = stampAuthors(
      [ann('e', { by: 'Bob' })],
      [ann('e', { by: 'Alice' })],
      'Bob',
    );
    expect(kept?.by).toBe('Alice');
  });

  it('treats a re-attached annotation (new id, same anchor) as existing', () => {
    const [moved] = stampAuthors(
      [ann('y', { excerpt: 'hi' })],
      [ann('x', { excerpt: 'hi' })],
      'Bob',
    );
    expect(moved && 'by' in moved).toBe(false);
  });

  it('cleans a client-sent name on a new annotation and falls back to the viewer', () => {
    expect(stampAuthors([ann('n', { by: 'Eve ' })], [], 'Bob')[0]?.by).toBe(
      'Eve',
    );
    expect(stampAuthors([ann('n', { by: ' %% ' })], [], 'Bob')[0]?.by).toBe(
      'Bob',
    );
    const [unsigned] = stampAuthors([ann('n', { by: ' %% ' })], [], undefined);
    expect(unsigned && 'by' in unsigned).toBe(false);
  });
});
