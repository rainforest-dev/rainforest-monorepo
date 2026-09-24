import { expect, it } from 'vitest';

import { lineDiff } from './diff.ts';

it('marks nothing changed when both sides are identical', () => {
  const result = lineDiff('a\nb\nc', 'a\nb\nc');
  expect(result.a).toEqual([
    { text: 'a', changed: false },
    { text: 'b', changed: false },
    { text: 'c', changed: false },
  ]);
  expect(result.b).toEqual(result.a);
});

it('marks a single changed line on both sides', () => {
  const result = lineDiff('a\nb\nc', 'a\nx\nc');
  expect(result.a).toEqual([
    { text: 'a', changed: false },
    { text: 'b', changed: true },
    { text: 'c', changed: false },
  ]);
  expect(result.b).toEqual([
    { text: 'a', changed: false },
    { text: 'x', changed: true },
    { text: 'c', changed: false },
  ]);
});

it('marks an added line as changed only on the side that has it', () => {
  const result = lineDiff('a\nb', 'a\nb\nc');
  expect(result.a).toEqual([
    { text: 'a', changed: false },
    { text: 'b', changed: false },
  ]);
  expect(result.b).toEqual([
    { text: 'a', changed: false },
    { text: 'b', changed: false },
    { text: 'c', changed: true },
  ]);
});

it('marks a removed line as changed only on the side that has it', () => {
  const result = lineDiff('a\nb\nc', 'a\nc');
  expect(result.a).toEqual([
    { text: 'a', changed: false },
    { text: 'b', changed: true },
    { text: 'c', changed: false },
  ]);
  expect(result.b).toEqual([
    { text: 'a', changed: false },
    { text: 'c', changed: false },
  ]);
});

it('handles empty sides', () => {
  expect(lineDiff('', '')).toEqual({ a: [], b: [] });
  expect(lineDiff('a\nb', '')).toEqual({
    a: [
      { text: 'a', changed: true },
      { text: 'b', changed: true },
    ],
    b: [],
  });
  expect(lineDiff('', 'a\nb')).toEqual({
    a: [],
    b: [
      { text: 'a', changed: true },
      { text: 'b', changed: true },
    ],
  });
});
