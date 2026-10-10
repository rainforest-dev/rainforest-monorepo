import { describe, expect, it } from 'vitest';

import { nameOf, type Person, personOf, photographerOf } from './people.ts';

const PEOPLE: Person[] = [
  {
    id: 'bob',
    name: 'Bob',
    aliases: { line: ['Bobby 🌷'], slack: ['bob.w'], photo: ['Robert'] },
  },
  { id: 'alice', name: 'Alice', aliases: { line: ['Ali'] } },
];

describe('personOf and nameOf', () => {
  it('resolves an alias on its own platform only', () => {
    expect(personOf(PEOPLE, 'line', 'Bobby 🌷')?.id).toBe('bob');
    expect(personOf(PEOPLE, 'slack', 'bob.w')?.id).toBe('bob');
    expect(personOf(PEOPLE, 'photo', 'Robert')?.id).toBe('bob');
    expect(personOf(PEOPLE, 'slack', 'Bobby 🌷')).toBeUndefined();
  });

  it('accepts the canonical name on any platform', () => {
    expect(personOf(PEOPLE, 'slack', 'Alice')?.id).toBe('alice');
  });

  it('falls back to the raw name for anyone not configured', () => {
    expect(nameOf(PEOPLE, 'line', 'Bobby 🌷')).toBe('Bob');
    expect(nameOf(PEOPLE, 'line', 'Carol')).toBe('Carol');
    expect(nameOf([], 'line', 'Carol')).toBe('Carol');
  });
});

describe('photographerOf', () => {
  it('maps a camera model to the person who owns the device', () => {
    const people: Person[] = [
      ...PEOPLE,
      { id: 'carol', name: 'Carol', aliases: {}, devices: ['Pixel 5'] },
    ];
    expect(photographerOf(people, 'Pixel 5')?.id).toBe('carol');
    expect(photographerOf(people, 'iPhone 16 Pro')).toBeUndefined();
    expect(photographerOf(people, undefined)).toBeUndefined();
  });
});
