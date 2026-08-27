import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GET } from './bundle.js';

let saved: string | undefined;
let dir: string;

beforeEach(() => {
  saved = process.env.LOOP_ENGINE_BUNDLE;
  dir = mkdtempSync(join(tmpdir(), 'loop-engine-bundle-'));
});

afterEach(() => {
  if (saved === undefined) delete process.env.LOOP_ENGINE_BUNDLE;
  else process.env.LOOP_ENGINE_BUNDLE = saved;
  rmSync(dir, { recursive: true, force: true });
});

describe('GET /api/enroll/bundle', () => {
  it('503s when LOOP_ENGINE_BUNDLE is unset', async () => {
    delete process.env.LOOP_ENGINE_BUNDLE;
    // @ts-expect-error -- Astro's APIRoute signature wants a full context;
    // this route reads none of it, matching probes.ts and facts.ts.
    const res = await GET({});
    expect(res.status).toBe(503);
  });

  it('503s when LOOP_ENGINE_BUNDLE points at a missing file', async () => {
    process.env.LOOP_ENGINE_BUNDLE = join(dir, 'does-not-exist.tar.gz');
    // @ts-expect-error -- see above
    const res = await GET({});
    expect(res.status).toBe(503);
  });

  it('503s, not 200, when LOOP_ENGINE_BUNDLE points at a directory', async () => {
    // statSync() succeeds on a directory, so a naive existence check alone
    // would 200 with a bogus content-length here -- the real failure
    // (EISDIR) would only surface once something tried to read the body.
    process.env.LOOP_ENGINE_BUNDLE = dir;
    // @ts-expect-error -- see above
    const res = await GET({});
    expect(res.status).toBe(503);
  });
});
