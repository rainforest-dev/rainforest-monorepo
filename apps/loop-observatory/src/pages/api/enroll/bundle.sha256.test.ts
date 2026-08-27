import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GET } from './bundle.sha256.js';

let saved: string | undefined;
let dir: string;

beforeEach(() => {
  saved = process.env.LOOP_ENGINE_BUNDLE;
  dir = mkdtempSync(join(tmpdir(), 'loop-engine-sha-'));
});

afterEach(() => {
  if (saved === undefined) delete process.env.LOOP_ENGINE_BUNDLE;
  else process.env.LOOP_ENGINE_BUNDLE = saved;
  rmSync(dir, { recursive: true, force: true });
});

function bundle(contents = 'pretend tarball'): string {
  const path = join(dir, 'loop-engine-2026.08.27-abc1234.tar.gz');
  writeFileSync(path, contents);
  process.env.LOOP_ENGINE_BUNDLE = path;
  return path;
}

// @ts-expect-error -- Astro's APIRoute signature wants a full context; this
// route reads none of it, matching bundle.ts.
const get = (): Promise<Response> | Response => GET({});

/**
 * `shasum` ships with macOS and with any Linux that has perl, but that is a
 * property of the runner and not something to assume -- CI's ubuntu image has
 * no `plutil`, which is how the reproduction gate came to be unrunnable there.
 * Detected, and the skip is named rather than silent.
 */
const HAVE_SHASUM = (() => {
  try {
    execFileSync('shasum', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('GET /api/enroll/bundle.sha256', () => {
  it(
    HAVE_SHASUM
      ? 'shasum is present, so the format check below RAN'
      : 'shasum is absent here, so the `shasum -c` format check DID NOT RUN',
    () => {
      expect(typeof HAVE_SHASUM).toBe('boolean');
    },
  );

  it('503s when the bundle is not configured or not there', async () => {
    delete process.env.LOOP_ENGINE_BUNDLE;
    expect((await get()).status).toBe(503);
    process.env.LOOP_ENGINE_BUNDLE = join(dir, 'missing.tar.gz');
    expect((await get()).status).toBe(503);
  });

  it('serves the digest CI published, not one it computed itself', async () => {
    // The point of preferring the sidecar: the value the machine checks against
    // is the one produced from the tag, not a digest of whatever this host
    // happens to have mounted.
    const path = bundle();
    writeFileSync(
      `${path}.sha256`,
      `${'a'.repeat(64)}  loop-engine-2026.08.27-abc1234.tar.gz\n`,
    );
    const body = await (await get()).text();
    expect(body).toBe(`${'a'.repeat(64)}  loop-engine.tar.gz\n`);
  });

  it('computes the digest when no sidecar is mounted', async () => {
    bundle('some bytes');
    const expected = createHash('sha256').update('some bytes').digest('hex');
    expect(await (await get()).text()).toBe(
      `${expected}  loop-engine.tar.gz\n`,
    );
  });

  it.skipIf(!HAVE_SHASUM)(
    'emits a line `shasum -c` actually accepts',
    async () => {
      // The whole value of this route is that step 3 can pipe it into shasum. A
      // format nobody verified would be the same unchecked-writer shape as the
      // .sha256 that CI has been publishing to no consumer at all.
      bundle('some bytes');
      const line = await (await get()).text();
      const saveDir = mkdtempSync(join(tmpdir(), 'loop-engine-verify-'));
      try {
        writeFileSync(join(saveDir, 'loop-engine.tar.gz'), 'some bytes');
        writeFileSync(join(saveDir, 'loop-engine.tar.gz.sha256'), line);
        expect(() =>
          execFileSync(
            'shasum',
            ['-a', '256', '-c', 'loop-engine.tar.gz.sha256'],
            {
              cwd: saveDir,
              stdio: 'pipe',
            },
          ),
        ).not.toThrow();

        // And it must FAIL on altered bytes, or the check proves nothing.
        writeFileSync(join(saveDir, 'loop-engine.tar.gz'), 'other bytes');
        expect(() =>
          execFileSync(
            'shasum',
            ['-a', '256', '-c', 'loop-engine.tar.gz.sha256'],
            {
              cwd: saveDir,
              stdio: 'pipe',
            },
          ),
        ).toThrow();
      } finally {
        rmSync(saveDir, { recursive: true, force: true });
      }
    },
  );
});
