import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAffected } from './parse-affected.mjs';

test('parses a clean JSON array', () => {
  assert.deepEqual(
    parseAffected('["personal-memories","@rainforest-monorepo/rss-manager"]\n'),
    ['personal-memories', '@rainforest-monorepo/rss-manager'],
  );
});

test('an empty array means nothing affected', () => {
  assert.deepEqual(parseAffected('[]'), []);
});

test('finds the array after plugin noise on stdout', () => {
  const out =
    'warn: next.config loaded\n{"not":"an array"}\n["personal-calibre"]\n';
  assert.deepEqual(parseAffected(out), ['personal-calibre']);
});

test('takes the last array line when several are printed', () => {
  assert.deepEqual(parseAffected('["stale"]\nnoise\n["personal-memories"]'), [
    'personal-memories',
  ]);
});

test('fails loudly when there is no array at all', () => {
  assert.throws(
    () => parseAffected('NX  Failed to process project graph'),
    /no affected-projects JSON array/,
  );
});

test('fails loudly on empty output', () => {
  assert.throws(() => parseAffected(''), /no affected-projects JSON array/);
});
