import { describe, expect, it } from 'vitest';

import type { Searchable } from './search';
import {
  hashRecord,
  MAX_TERM_LENGTH,
  MAX_TERMS,
  normalizeTerms,
  planExpansion,
  serializeExpansions,
} from './search-expansions';

const record = (overrides: Partial<Searchable> = {}): Searchable => ({
  id: 'skill/docker',
  kind: 'skill',
  title: 'Docker',
  keywords: ['containers', 'devops'],
  href: '/#skills',
  ...overrides,
});

describe('hashRecord', () => {
  it('is stable for equal input and ignores id and href', () => {
    expect(hashRecord(record())).toBe(
      hashRecord(record({ id: 'other', href: '/x' })),
    );
  });

  it('changes with title, keywords or kind', () => {
    const base = hashRecord(record());
    expect(hashRecord(record({ title: 'Podman' }))).not.toBe(base);
    expect(hashRecord(record({ keywords: ['devops'] }))).not.toBe(base);
    expect(hashRecord(record({ kind: 'project' }))).not.toBe(base);
  });
});

describe('normalizeTerms', () => {
  const r = record();

  it('trims, drops blanks and dedupes case-insensitively', () => {
    expect(normalizeTerms([' VM ', 'vm', '', '  ', 'Vm', '虛擬化'], r)).toEqual(
      ['VM', '虛擬化'],
    );
  });

  it('drops terms longer than the limit', () => {
    const long = 'x'.repeat(MAX_TERM_LENGTH + 1);
    const exact = 'y'.repeat(MAX_TERM_LENGTH);
    expect(normalizeTerms([long, exact], r)).toEqual([exact]);
  });

  it('drops words already in the title or keywords', () => {
    expect(
      normalizeTerms(['docker', 'DevOps', 'Containers', 'image'], r),
    ).toEqual(['image']);
  });

  it('drops a single word of a multi-word title', () => {
    const title = record({ title: 'Research Assistant · WeBIM Service' });
    expect(normalizeTerms(['service', 'research', '前端'], title)).toEqual([
      '前端',
    ]);
  });

  it('keeps at most MAX_TERMS terms', () => {
    const raw = Array.from({ length: 20 }, (_, i) => `term${i}`);
    expect(normalizeTerms(raw, r)).toHaveLength(MAX_TERMS);
  });
});

describe('planExpansion', () => {
  const a = record({ id: 'a' });
  const b = record({ id: 'b', title: 'Podman' });

  it('keeps unchanged records and queues new or changed ones', () => {
    const existing = {
      a: { hash: hashRecord(a), terms: ['x'] },
      b: { hash: 'stale', terms: ['y'] },
    };
    const plan = planExpansion([a, b, record({ id: 'c' })], existing);
    expect(Object.keys(plan.keep)).toEqual(['a']);
    expect(plan.pending.map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('drops ids that are no longer present', () => {
    const existing = { gone: { hash: 'h', terms: ['x'] } };
    expect(planExpansion([a], existing).keep).toEqual({});
  });

  it('queues nothing when every hash matches', () => {
    const existing = { a: { hash: hashRecord(a), terms: [] } };
    expect(planExpansion([a], existing).pending).toEqual([]);
  });
});

describe('serializeExpansions', () => {
  it('sorts ids so a rerun produces identical bytes', () => {
    const one = serializeExpansions({
      model: 'm',
      records: { b: { hash: '1', terms: [] }, a: { hash: '2', terms: [] } },
    });
    const two = serializeExpansions({
      model: 'm',
      records: { a: { hash: '2', terms: [] }, b: { hash: '1', terms: [] } },
    });
    expect(one).toBe(two);
    expect(one.endsWith('\n')).toBe(true);
  });
});
