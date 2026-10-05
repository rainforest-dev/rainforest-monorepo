import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { notePayload } from './notes-payload.ts';
import { createNotesStore } from './notes-store.ts';

let root = '';
afterEach(() => root && rmSync(root, { recursive: true, force: true }));

it('is read-only and empty without a store', () => {
  expect(notePayload(undefined, '2025-11-01', [])).toEqual({
    date: '2025-11-01',
    body: '',
    annotations: [],
    version: '',
    writable: false,
    people: [],
  });
});

it('carries the people it was given', () => {
  const people = [{ id: 'a', name: 'Alice', aliases: {} }];
  expect(
    notePayload(undefined, '2025-11-01', [], undefined, people).people,
  ).toBe(people);
});

it('marks an unparseable file read-only', () => {
  root = mkdtempSync(join(tmpdir(), 'notes-'));
  mkdirSync(join(root, '2025'));
  writeFileSync(join(root, '2025', '2025-11-01.md'), '---\nmood: [\n---\n');
  const payload = notePayload(createNotesStore(root), '2025-11-01', []);
  expect(payload.writable).toBe(false);
  expect(payload.parseError).toBe(true);
});

it('resolves annotations against the day', () => {
  root = mkdtempSync(join(tmpdir(), 'notes-'));
  const store = createNotesStore(root);
  store.write(
    '2025-11-01',
    {
      body: 'x',
      annotations: [
        {
          eventId: 'gone',
          at: '',
          source: 'line',
          author: 'A',
          excerpt: 'q',
          body: 'n',
        },
      ],
    },
    '',
  );
  const payload = notePayload(store, '2025-11-01', []);
  expect(payload.writable).toBe(true);
  expect(payload.annotations[0].status).toBe('unattached');
});

it('passes the resolved viewer name to the panel', () => {
  expect(notePayload(undefined, '2025-11-01', [], 'Alice').viewer).toBe(
    'Alice',
  );
  expect('viewer' in notePayload(undefined, '2025-11-01', [])).toBe(false);
});
