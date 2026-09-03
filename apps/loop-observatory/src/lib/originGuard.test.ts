import { describe, expect, it } from 'vitest';

import { allowedOrigins, checkRequestOrigin } from './originGuard.js';

const PUBLIC = 'https://loop.rainforest.tools';
const INTERNAL = 'http://100.86.67.66:3099';

function req(method: string, origin?: string) {
  const headers = new Map<string, string>();
  if (origin !== undefined) headers.set('origin', origin);
  return {
    method,
    headers: { get: (n: string) => headers.get(n.toLowerCase()) ?? null },
  };
}

describe('allowedOrigins', () => {
  it('defaults to the public address without any configuration', () => {
    expect([...allowedOrigins({})]).toEqual([PUBLIC]);
  });

  it('follows SITE_URL, which astro.config already reads', () => {
    expect([
      ...allowedOrigins({ SITE_URL: 'https://elsewhere.example' }),
    ]).toEqual(['https://elsewhere.example']);
  });

  it('normalises a trailing slash or path to a bare origin', () => {
    // A browser sends the origin only. `https://x.example/` in config would
    // never have matched it, and the mismatch is invisible in a diff.
    expect([
      ...allowedOrigins({ SITE_URL: 'https://x.example/dash/' }),
    ]).toEqual(['https://x.example']);
  });

  it('takes extra origins as a comma-separated list', () => {
    const got = allowedOrigins({
      SITE_URL: PUBLIC,
      OBSERVATORY_ALLOWED_ORIGINS: `${INTERNAL}, https://alt.example`,
    });
    expect([...got].sort()).toEqual(
      [PUBLIC, INTERNAL, 'https://alt.example'].sort(),
    );
  });

  it('drops an unparseable entry instead of widening the allowlist', () => {
    const got = allowedOrigins({
      SITE_URL: PUBLIC,
      OBSERVATORY_ALLOWED_ORIGINS: 'not a url,,https://ok.example',
    });
    expect([...got].sort()).toEqual([PUBLIC, 'https://ok.example'].sort());
  });
});

describe('checkRequestOrigin', () => {
  const allowed = allowedOrigins({ SITE_URL: PUBLIC });

  it('accepts the public origin a browser sends through the proxy', () => {
    // The regression this exists for: the container receives the request over
    // http, so Astro compared https://… against http://… and refused.
    expect(
      checkRequestOrigin(
        req('POST', PUBLIC),
        `${INTERNAL}/api/refresh`,
        allowed,
      ),
    ).toEqual({ ok: true });
  });

  it('still accepts same-origin without any configuration naming it', () => {
    expect(
      checkRequestOrigin(
        req('POST', INTERNAL),
        `${INTERNAL}/api/refresh`,
        allowedOrigins({}),
      ),
    ).toEqual({ ok: true });
  });

  it('refuses an origin that is neither same-origin nor allowlisted', () => {
    const v = checkRequestOrigin(
      req('POST', 'https://evil.example'),
      `${INTERNAL}/api/refresh`,
      allowed,
    );
    expect(v.ok).toBe(false);
    expect(v).toMatchObject({ status: 403 });
  });

  it('names the rejected origin, so the failure is diagnosable from the body', () => {
    const v = checkRequestOrigin(
      req('POST', 'https://evil.example'),
      `${INTERNAL}/api/refresh`,
      allowed,
    );
    expect(v.ok === false && v.reason).toContain('https://evil.example');
  });

  it('refuses a state-changing request that carries no Origin at all', () => {
    const v = checkRequestOrigin(
      req('POST'),
      `${INTERNAL}/api/refresh`,
      allowed,
    );
    expect(v).toMatchObject({ ok: false, status: 403 });
  });

  it.each(['GET', 'HEAD'])('never blocks %s', (method) => {
    // Blocking these would break every page load, and they are not what a
    // forged cross-site request would use to change something here.
    expect(checkRequestOrigin(req(method), `${INTERNAL}/`, allowed)).toEqual({
      ok: true,
    });
  });

  it.each(['PUT', 'PATCH', 'DELETE'])('guards %s as well as POST', (method) => {
    expect(
      checkRequestOrigin(
        req(method, 'https://evil.example'),
        `${INTERNAL}/api/task-decision`,
        allowed,
      ),
    ).toMatchObject({ ok: false });
  });

  it('treats a lowercase method the same as an uppercase one', () => {
    expect(
      checkRequestOrigin(
        req('post', 'https://evil.example'),
        `${INTERNAL}/api/refresh`,
        allowed,
      ),
    ).toMatchObject({ ok: false });
  });

  it('refuses an Origin that is not a URL rather than passing it through', () => {
    expect(
      checkRequestOrigin(
        req('POST', 'null'),
        `${INTERNAL}/api/refresh`,
        allowed,
      ),
    ).toMatchObject({ ok: false, status: 403 });
  });
});
