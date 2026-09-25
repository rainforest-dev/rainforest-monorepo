import { describe, expect, it } from 'vitest';

import {
  cleanName,
  originOf,
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

  it('drops a trailing space left by truncating at exactly 40 characters', () => {
    const raw = `${'x'.repeat(39)} text that runs past the limit`;
    expect(cleanName(raw)).toBe('x'.repeat(39));
  });

  it('never splits a surrogate pair when truncating at the boundary', () => {
    const raw = `${'y'.repeat(39)}🌷${'z'.repeat(10)}`;
    const result = cleanName(raw);
    expect(result).toBe(`${'y'.repeat(39)}🌷`);
    expect([...result]).toHaveLength(40);
  });
});

describe('originOf', () => {
  it('uses the eventId when present, else the anchor tuple', () => {
    const withId = {
      eventId: 'abc',
      at: '2025-11-01T09:00:00+08:00',
      source: 'line' as const,
      author: 'Alice',
      excerpt: 'hi',
    };
    expect(originOf(withId)).toBe('abc');
    expect(originOf({ ...withId, eventId: '' })).not.toBe('');
    expect(originOf({ ...withId, eventId: '' })).toBe(
      originOf({ ...withId, eventId: '' }),
    );
  });
});

describe('stampAuthors', () => {
  const ann = (
    eventId: string,
    extra: {
      by?: string;
      excerpt?: string;
      origin?: string;
      at?: string;
      author?: string;
    } = {},
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
      [ann('old', { origin: 'old' }), ann('new')],
      [ann('old')],
      'Bob',
    );
    expect(old && 'by' in old).toBe(false);
    expect(added?.by).toBe('Bob');
  });

  it('leaves a legacy unsigned annotation unsigned when another user saves', () => {
    const [legacy] = stampAuthors(
      [ann('legacy', { origin: 'legacy' })],
      [ann('legacy')],
      'Bob',
    );
    expect(legacy && 'by' in legacy).toBe(false);
  });

  it('keeps the stored author even if the client sends another', () => {
    const [kept] = stampAuthors(
      [ann('e', { origin: 'e', by: 'Bob' })],
      [ann('e', { by: 'Alice' })],
      'Bob',
    );
    expect(kept?.by).toBe('Alice');
  });

  it('treats a real re-attach (new eventId, at, author, excerpt; same origin) as existing', () => {
    const reattached = ann('y', {
      at: '2025-11-01T10:00:00+08:00',
      author: 'Bob',
      excerpt: 'hi',
      origin: 'x',
    });

    const [legacyStaysUnsigned] = stampAuthors([reattached], [ann('x')], 'Bob');
    expect(legacyStaysUnsigned && 'by' in legacyStaysUnsigned).toBe(false);

    const [alicesStaysAlice] = stampAuthors(
      [reattached],
      [ann('x', { by: 'Alice' })],
      'Bob',
    );
    expect(alicesStaysAlice?.by).toBe('Alice');
  });

  it("signs a brand-new annotation on the same event as a just-deleted one with the viewer, not the deleted one's author", () => {
    const staleOnDisk = ann('E', { by: 'Alice' });
    const freshlyCreated = ann('E');
    const [stamped] = stampAuthors([freshlyCreated], [staleOnDisk], 'Bob');
    expect(stamped?.by).toBe('Bob');
  });

  it('lets the mapped viewer override a client-sent name on a new annotation, and only falls back to the client name when the viewer is unmapped', () => {
    expect(stampAuthors([ann('n', { by: 'Eve' })], [], 'Bob')[0]?.by).toBe(
      'Bob',
    );
    expect(stampAuthors([ann('n', { by: 'Eve ' })], [], undefined)[0]?.by).toBe(
      'Eve',
    );
    const [unsigned] = stampAuthors([ann('n', { by: ' %% ' })], [], undefined);
    expect(unsigned && 'by' in unsigned).toBe(false);
  });
});
