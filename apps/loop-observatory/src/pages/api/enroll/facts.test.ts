import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FIXTURES } from '../../../lib/enroll/fixtures.js';
import { MAX_HOSTS, readHosts } from '../../../lib/enroll/store.js';
import { POST } from './facts.js';

let saved: string | undefined;
let dir: string;

beforeEach(() => {
  saved = process.env.VAULT_PATH;
  dir = mkdtempSync(join(tmpdir(), 'enroll-facts-'));
  process.env.VAULT_PATH = dir;
});

afterEach(() => {
  if (saved === undefined) delete process.env.VAULT_PATH;
  else process.env.VAULT_PATH = saved;
  rmSync(dir, { recursive: true, force: true });
});

function post(body: string): Promise<Response> {
  const request = new Request('http://localhost/api/enroll/facts', {
    method: 'POST',
    body,
  });
  // @ts-expect-error -- Astro's APIRoute signature wants a full context; this
  // route reads only `request`, matching bundle.test.ts.
  return POST({ request });
}

// Pinned to `denied` rather than taken as-is: this asserts the endpoint STORES
// what it was sent, so the value has to be one the test chose. Reading it from a
// live host's fixture made the assertion fail when that host's TCC actually
// changed, which says nothing about the endpoint.
const FACTS = {
  ...FIXTURES['rainforest-air']!.facts,
  tccICloud: 'denied' as const,
};

describe('POST /api/enroll/facts', () => {
  it('records a well-formed report', async () => {
    const res = await post(JSON.stringify({ host: 'h', facts: FACTS }));
    expect(res.status).toBe(200);
    expect(readHosts()['h']?.facts?.tccICloud).toBe('denied');
  });

  it('413s an oversized body instead of buffering it', async () => {
    // request.json() buffers whatever arrives, so the cap has to happen while
    // reading. These records land in an iCloud-synced directory behind an
    // unauthenticated endpoint; without a cap any caller can fill that disk.
    const huge = JSON.stringify({
      host: 'h',
      facts: { ...FACTS, brewPrefix: 'x'.repeat(200_000) },
    });
    const res = await post(huge);
    expect(res.status).toBe(413);
    expect(readHosts()['h']).toBeUndefined();
  });

  it('400s a body that is within the cap but not valid facts', async () => {
    // The cap and the schema are separate gates, and a small bad body must
    // still be refused rather than partially stored.
    const res = await post(
      JSON.stringify({ host: 'h', facts: { ...FACTS, tccICloud: 'maybe' } }),
    );
    expect(res.status).toBe(400);
    expect(readHosts()['h']).toBeUndefined();
  });

  it('507s a new host once the store is full, and still accepts a known one', async () => {
    for (let i = 0; i < MAX_HOSTS; i++) {
      expect(
        (await post(JSON.stringify({ host: `h${i}`, facts: FACTS }))).status,
      ).toBe(200);
    }
    expect(
      (await post(JSON.stringify({ host: 'overflow', facts: FACTS }))).status,
    ).toBe(507);
    // A full store must not freeze the hosts already in it: the alternative is
    // every real machine's facts stuck at whatever they last were, which is a
    // stale record shown as current.
    expect(
      (
        await post(
          JSON.stringify({
            host: 'h0',
            facts: { ...FACTS, otlpListening: false },
          }),
        )
      ).status,
    ).toBe(200);
    expect(readHosts()['h0']?.facts?.otlpListening).toBe(false);
  });
});
