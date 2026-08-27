import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import type { APIRoute } from 'astro';

/** The name `bundle.ts` hands out via content-disposition, and what step 3 saves. */
const SAVED_AS = 'loop-engine.tar.gz';

/**
 * The bundle's SHA-256, in `shasum -c` format.
 *
 * `release-loop-engine.yml` has published a `.sha256` beside every release
 * asset since the workflow was written, and nothing consumed it: the setup page
 * told the machine to `curl … | tar xz` over plain http with no integrity check
 * at all, so a truncated transfer extracted a partial engine and nothing said
 * so. This is the reader for that file.
 *
 * Prefers the published sidecar over recomputing, so the value the machine
 * checks against is the one CI produced from the tag rather than a digest of
 * whatever this host happens to have mounted. The filename inside is rewritten
 * to `loop-engine.tar.gz` because the release asset is versioned
 * (`loop-engine-2026.08.27-abc1234.tar.gz`) while the file the machine saves is
 * not, and `shasum -c` matches on the name in the line.
 *
 * ## What this does and does not prove
 *
 * The tailnet URL is plain http and this digest comes from the same host as the
 * bytes, so it catches a truncated, corrupted or partially-served download --
 * not a host that has been tampered with, which could serve a matching digest
 * for altered bytes just as easily. Provenance comes from comparing against the
 * `.sha256` on the GitHub Release, which is served over HTTPS from a different
 * origin. The setup page says so rather than implying more than is true.
 */
export const GET: APIRoute = () => {
  const path = process.env.LOOP_ENGINE_BUNDLE;
  if (!path)
    return new Response('LOOP_ENGINE_BUNDLE is not configured', {
      status: 503,
    });

  try {
    if (!statSync(path).isFile())
      return new Response('bundle not readable', { status: 503 });
  } catch {
    return new Response('bundle not readable', { status: 503 });
  }

  let digest: string | null = null;
  try {
    // `shasum -a 256 x.tar.gz` writes "<64 hex>  x.tar.gz".
    const sidecar = readFileSync(`${path}.sha256`, 'utf-8');
    digest = /^([0-9a-f]{64})\b/.exec(sidecar.trim())?.[1] ?? null;
  } catch {
    digest = null; // no sidecar mounted; fall through to computing it
  }

  if (!digest) {
    try {
      digest = createHash('sha256').update(readFileSync(path)).digest('hex');
    } catch {
      return new Response('bundle not readable', { status: 503 });
    }
  }

  return new Response(`${digest}  ${SAVED_AS}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
