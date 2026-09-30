import { describe, expect, it } from 'vitest';

import {
  cleanName,
  originOf,
  parseAuthors,
  type Signable,
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
  const withId = {
    eventId: 'abc',
    at: '2025-11-01T09:00:00+08:00',
    source: 'line' as const,
    author: 'Alice',
    excerpt: 'hi',
  };

  it('prefixes an eventId-based origin distinctly from a hashed anchor-tuple one', () => {
    expect(originOf(withId)).toBe('e:abc');
    expect(originOf({ ...withId, eventId: '' })).toMatch(/^t:[0-9a-f]{8}$/);
  });

  it('is deterministic for the same anchor tuple', () => {
    expect(originOf({ ...withId, eventId: '' })).toBe(
      originOf({ ...withId, eventId: '' }),
    );
  });

  it('stays short and bounded no matter how long the heading and quote are', () => {
    const handWritten = {
      eventId: '',
      at: '',
      source: 'line' as const,
      author: 'x'.repeat(1000),
      excerpt: 'y'.repeat(1000),
    };
    expect(originOf(handWritten).length).toBeLessThan(20);
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
      [
        ann('old', { origin: originOf(ann('old')) }),
        ann('new', { origin: 'new' }),
      ],
      [ann('old')],
      'Bob',
    );
    expect(old && 'by' in old).toBe(false);
    expect(added?.by).toBe('Bob');
  });

  it('leaves a legacy unsigned annotation unsigned when another user saves', () => {
    const [legacy] = stampAuthors(
      [ann('legacy', { origin: originOf(ann('legacy')) })],
      [ann('legacy')],
      'Bob',
    );
    expect(legacy && 'by' in legacy).toBe(false);
  });

  it('keeps the stored author even if the client sends another', () => {
    const [kept] = stampAuthors(
      [ann('e', { origin: originOf(ann('e')), by: 'Bob' })],
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
      origin: originOf(ann('x')),
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
    const freshlyCreated = ann('E', { origin: 'new' });
    const [stamped] = stampAuthors([freshlyCreated], [staleOnDisk], 'Bob');
    expect(stamped?.by).toBe('Bob');
  });

  it('lets the mapped viewer override a client-sent name on a new annotation, and only falls back to the client name when the viewer is unmapped', () => {
    expect(
      stampAuthors([ann('n', { by: 'Eve', origin: 'new' })], [], 'Bob')[0]?.by,
    ).toBe('Bob');
    expect(
      stampAuthors([ann('n', { by: 'Eve ', origin: 'new' })], [], undefined)[0]
        ?.by,
    ).toBe('Eve');
    const [unsigned] = stampAuthors(
      [ann('n', { by: ' %% ', origin: 'new' })],
      [],
      undefined,
    );
    expect(unsigned && 'by' in unsigned).toBe(false);
  });

  it('keep-mine restores an annotation as new when its origin matches nothing, even if a same-anchor annotation exists under a recovered eventId', () => {
    const mineFromBeforeTheConflict = ann('pre-conflict-event-id', {
      origin: originOf(ann('pre-conflict-event-id')),
      excerpt: 'same message',
    });
    const carolsAddedUnderRecoveredEventId = ann('recovered-event-id', {
      by: 'Carol',
      excerpt: 'same message',
    });
    const [result] = stampAuthors(
      [mineFromBeforeTheConflict],
      [carolsAddedUnderRecoveredEventId],
      'Bob',
    );
    expect(result?.by).toBe('Bob');
  });

  it('keeps a hand-written annotation with a 1,000-char heading and quote signed across a re-save', () => {
    const handWritten: Signable = {
      eventId: '',
      at: '',
      source: 'line' as const,
      author: 'x'.repeat(1000),
      excerpt: 'y'.repeat(1000),
    };
    const origin = originOf(handWritten);
    expect(origin.length).toBeLessThan(20);

    const [firstSave] = stampAuthors([handWritten], [], 'Alice');
    expect(firstSave?.by).toBe('Alice');

    const reSent = { ...handWritten, origin };
    const [reSaved] = stampAuthors(
      [reSent],
      [{ ...handWritten, by: 'Alice' }],
      'Bob',
    );
    expect(reSaved?.by).toBe('Alice');
  });
});

describe('stampAuthors with a client that sends no origin', () => {
  const ann = (
    eventId: string,
    extra: { by?: string; origin?: string } = {},
  ) => ({
    eventId,
    at: '2025-11-01T09:00:00+08:00',
    source: 'line' as const,
    author: 'Alice',
    excerpt: eventId,
    ...extra,
  });

  it('keeps every stored author, whether the viewer is mapped or not', () => {
    const stored = [ann('a', { by: 'Alice' }), ann('b', { by: 'Bob' })];
    const sent = [ann('a'), ann('b', { by: 'Alice' })];
    for (const viewer of ['Bob', undefined]) {
      expect(stampAuthors(sent, stored, viewer).map((a) => a.by)).toEqual([
        'Alice',
        'Bob',
      ]);
    }
  });

  it('does not sign a stored unsigned annotation', () => {
    const [legacy] = stampAuthors([ann('legacy')], [ann('legacy')], 'Bob');
    expect(legacy && 'by' in legacy).toBe(false);
  });

  it('signs an annotation that matches nothing on disk with the viewer', () => {
    const [added] = stampAuthors([ann('added')], [ann('other')], 'Bob');
    expect(added?.by).toBe('Bob');
  });
});

describe('stampAuthors with an explicit new origin', () => {
  const ann = (
    eventId: string,
    extra: { by?: string; origin?: string } = {},
  ) => ({
    eventId,
    at: '2025-11-01T09:00:00+08:00',
    source: 'line' as const,
    author: 'Alice',
    excerpt: eventId,
    ...extra,
  });

  it('signs it with the viewer even when it sits on an event already signed by someone else', () => {
    const [added] = stampAuthors(
      [ann('E', { origin: 'new', by: 'Alice' })],
      [ann('E', { by: 'Alice' })],
      'Bob',
    );
    expect(added?.by).toBe('Bob');
  });

  it("cannot take over another user's annotation by claiming its origin", () => {
    const [claimed] = stampAuthors(
      [ann('x', { origin: originOf(ann('E')), by: 'Bob' })],
      [ann('E', { by: 'Alice' })],
      'Bob',
    );
    expect(claimed?.by).toBe('Alice');
  });
});
