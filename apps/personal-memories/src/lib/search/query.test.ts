import { describe, expect, it } from 'vitest';

import type { Person } from '@/lib/people.ts';

import { localParser } from './query.ts';

const PEOPLE: Person[] = [
  { id: 'bob', name: 'Bob', aliases: { line: ['Bobby'] } },
  { id: 'dana', name: 'Dana', aliases: {} },
  { id: 'mom', name: '媽媽', aliases: {} },
];
const TODAY = '2026-10-01';

describe('localParser', () => {
  it('takes a leading date phrase as the range and leaves the rest as text', () => {
    expect(localParser('去年中秋 吃麵', TODAY, PEOPLE)).toEqual({
      text: '吃麵',
      range: { start: '2025-10-06', end: '2025-10-06' },
    });
  });

  it('takes a known name or alias as a person and drops 說的', () => {
    expect(localParser('Bob 說的拉麵', TODAY, PEOPLE)).toEqual({
      text: '拉麵',
      people: ['bob'],
    });
    expect(localParser('Bobby 拉麵', TODAY, PEOPLE)).toEqual({
      text: '拉麵',
      people: ['bob'],
    });
  });

  it('accepts a person on their own, leaving empty text', () => {
    expect(localParser('Bob', TODAY, PEOPLE)).toEqual({
      text: '',
      people: ['bob'],
    });
  });

  it('keeps everything as text when nothing is recognised', () => {
    expect(localParser('吃麵那天', TODAY, PEOPLE)).toEqual({
      text: '吃麵那天',
    });
  });

  it('accepts a date phrase on its own', () => {
    expect(localParser('上個月', TODAY, PEOPLE)).toEqual({
      text: '',
      range: { start: '2026-09-01', end: '2026-09-30' },
    });
  });

  it('keeps 的 when it belongs to a word', () => {
    expect(localParser('目的', TODAY, PEOPLE)).toEqual({ text: '目的' });
    expect(localParser('的士 司機', TODAY, PEOPLE)).toEqual({
      text: '的士 司機',
    });
  });

  it('finds a date at the end of the query', () => {
    expect(localParser('吃麵 去年中秋', TODAY, PEOPLE)).toEqual({
      text: '吃麵',
      range: { start: '2025-10-06', end: '2025-10-06' },
    });
  });

  it('finds a date and a Chinese name typed without spaces', () => {
    expect(localParser('去年中秋吃麵', TODAY, PEOPLE)).toEqual({
      text: '吃麵',
      range: { start: '2025-10-06', end: '2025-10-06' },
    });
    expect(localParser('媽媽說的拉麵', TODAY, PEOPLE)).toEqual({
      text: '拉麵',
      people: ['mom'],
    });
  });

  it('recognises a Latin name with punctuation, but not inside a longer word', () => {
    expect(localParser('Bob！', TODAY, PEOPLE)).toEqual({
      text: '',
      people: ['bob'],
    });
    expect(localParser('Bobsleigh', TODAY, PEOPLE)).toEqual({
      text: 'Bobsleigh',
    });
  });
});
