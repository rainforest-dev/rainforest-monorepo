import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { notePayload } from './payload.ts';
import { createNotesStore } from './store.ts';

let root = '';
afterEach(() => root && rmSync(root, { recursive: true, force: true }));

it('is read-only and empty without a store', () => {
  expect(notePayload(undefined, '2025-11-01', [])).toEqual({
    date: '2025-11-01',
    body: '',
    annotations: [],
    version: '',
    writable: false,
  });
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
