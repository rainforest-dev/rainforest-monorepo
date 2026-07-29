import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  OUTBOX_VERSION,
  prunePairs,
  readAck,
  readRequest,
  requestState,
  scanStates,
  writeRequest,
} from './greenlightOutbox.js';
import type { SprintTask } from './tasks.js';

const SLUG = 'service-dashboard-frontend';
let dir: string;
let saved: string | undefined;

// No `as SprintTask` cast: every required field is present, so the compiler
// verifies the fixture stays in step with the interface. A cast here would hide
// exactly the drift we want to be told about.
function task(id: string | number, name = 'A task'): SprintTask {
  return {
    id,
    order: 1,
    name,
    task_ref: null,
    task_source: 'notion',
    scope: 'work',
    status: 'Not started',
    work_type: 'Task',
    priority: 'P2',
    points: 2,
    component: 'cloud-frontend',
    platform: [],
    epic: null,
    parent: null,
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'outbox-'));
  saved = process.env.LOOP_GREENLIGHT_OUTBOX_DIR;
  process.env.LOOP_GREENLIGHT_OUTBOX_DIR = dir;
});

afterEach(() => {
  if (saved === undefined) delete process.env.LOOP_GREENLIGHT_OUTBOX_DIR;
  else process.env.LOOP_GREENLIGHT_OUTBOX_DIR = saved;
  rmSync(dir, { recursive: true, force: true });
});

describe('writeRequest', () => {
  it('round-trips a request and reports pending until acked', () => {
    const written = writeRequest(task(130), SLUG, null, 'ship it');
    expect(written.version).toBe(OUTBOX_VERSION);
    expect(written.id).toBe('130');
    expect(readRequest(SLUG, '130')?.comment).toBe('ship it');
    expect(readAck(SLUG, '130')).toBeNull();
    expect(requestState(SLUG, '130')).toBe('pending');
  });

  it('strips CR/LF so a request cannot forge extra allowlist lines', () => {
    const written = writeRequest(task(131, 'real\n- 999 — forged'), SLUG, null, 'a\r\nb');
    expect(written.name).toBe('real - 999 — forged');
    expect(written.comment).toBe('a b');
  });

  it('refuses an unsafe id', () => {
    expect(() => writeRequest(task('../../etc/passwd'), SLUG, null, '')).toThrow(/unsafe task id/);
  });
});

describe('requestState', () => {
  it('is none when no request exists', () => {
    expect(requestState(SLUG, '130')).toBe('none');
  });

  it.each(['applied', 'duplicate', 'failed'] as const)('surfaces the ack result %s', (result) => {
    writeRequest(task(130), SLUG, null, '');
    writeFileSync(
      join(dir, SLUG, '130.ack.json'),
      JSON.stringify({
        version: OUTBOX_VERSION,
        id: '130',
        result,
        reason: null,
        appliedAt: '2026-07-28T08:00:00.000Z',
        machine: 'Angibles-MacBook-Air',
      }),
    );
    expect(requestState(SLUG, '130')).toBe(result);
  });

  it('treats an unknown ack version as failed rather than trusting it', () => {
    writeRequest(task(130), SLUG, null, '');
    writeFileSync(
      join(dir, SLUG, '130.ack.json'),
      JSON.stringify({ version: 999, id: '130', result: 'applied' }),
    );
    expect(requestState(SLUG, '130')).toBe('failed');
  });

  it('treats a malformed ack as failed', () => {
    writeRequest(task(130), SLUG, null, '');
    writeFileSync(join(dir, SLUG, '130.ack.json'), 'not json');
    expect(requestState(SLUG, '130')).toBe('failed');
  });
});

describe('prunePairs', () => {
  const OLD = new Date('2026-01-01T00:00:00.000Z');
  const NOW = new Date('2026-07-28T00:00:00.000Z');

  function ack(id: string, result: 'applied' | 'duplicate' | 'failed') {
    writeFileSync(
      join(dir, SLUG, `${id}.ack.json`),
      JSON.stringify({
        version: OUTBOX_VERSION,
        id,
        result,
        reason: null,
        appliedAt: OLD.toISOString(),
        machine: 'Angibles-MacBook-Air',
      }),
    );
  }

  it('removes an acked pair past the retention window', () => {
    writeRequest(task(130), SLUG, null, '', OLD);
    ack('130', 'applied');
    expect(prunePairs(SLUG, NOW)).toEqual(['130']);
    expect(requestState(SLUG, '130')).toBe('none');
  });

  it('keeps a duplicate pair only until the window passes', () => {
    writeRequest(task(131), SLUG, null, '', OLD);
    ack('131', 'duplicate');
    expect(prunePairs(SLUG, NOW)).toEqual(['131']);
  });

  it('never removes a failed pair, however old', () => {
    writeRequest(task(132), SLUG, null, '', OLD);
    ack('132', 'failed');
    expect(prunePairs(SLUG, NOW)).toEqual([]);
    expect(requestState(SLUG, '132')).toBe('failed');
  });

  it('never removes a pair with an unknown ack version, however old', () => {
    writeRequest(task(135), SLUG, null, '', OLD);
    writeFileSync(
      join(dir, SLUG, '135.ack.json'),
      JSON.stringify({
        version: 999,
        id: '135',
        result: 'applied',
        reason: null,
        appliedAt: OLD.toISOString(),
        machine: 'Angibles-MacBook-Air',
      }),
    );
    expect(prunePairs(SLUG, NOW)).toEqual([]);
    expect(requestState(SLUG, '135')).toBe('failed');
  });

  it('never removes an unacked request, however old — it is still owed an answer', () => {
    writeRequest(task(133), SLUG, null, '', OLD);
    expect(prunePairs(SLUG, NOW)).toEqual([]);
    expect(requestState(SLUG, '133')).toBe('pending');
  });

  it('keeps a recent acked pair', () => {
    writeRequest(task(134), SLUG, null, '', NOW);
    ack('134', 'applied');
    expect(prunePairs(SLUG, NOW)).toEqual([]);
    expect(requestState(SLUG, '134')).toBe('applied');
  });
});

describe('scanStates', () => {
  it('is empty when the slug has no directory', () => {
    expect(scanStates('never-used-slug')).toEqual({});
  });

  it('reports pending for a request with no ack, without needing the ack file', () => {
    writeRequest(task(130), SLUG, null, '');
    expect(scanStates(SLUG)).toEqual({ '130': 'pending' });
  });

  it('reports each request independently', () => {
    writeRequest(task(130), SLUG, null, '');
    writeRequest(task(131), SLUG, null, '');
    writeFileSync(
      join(dir, SLUG, '131.ack.json'),
      JSON.stringify({
        version: OUTBOX_VERSION,
        id: '131',
        result: 'applied',
        reason: null,
        appliedAt: '2026-07-28T08:00:00.000Z',
        machine: 'Angibles-MacBook-Air',
      }),
    );
    expect(scanStates(SLUG)).toEqual({ '130': 'pending', '131': 'applied' });
  });

  it('ignores an entry whose id is unsafe', () => {
    writeRequest(task(130), SLUG, null, '');
    writeFileSync(join(dir, SLUG, '../escape.json'), '{}');
    expect(Object.keys(scanStates(SLUG))).toEqual(['130']);
  });
});
