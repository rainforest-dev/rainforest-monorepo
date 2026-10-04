import { afterEach, describe, expect, it, vi } from 'vitest';

import { patchRegistry } from './patchRegistry.js';

function respondWith(body: string, init: ResponseInit) {
  const fetchMock = vi.fn(async () => new Response(body, init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('patchRegistry', () => {
  it('sends names and returns the list the server re-parsed', async () => {
    const sources = [{ name: 'Astro', status: 'retired' }];
    const fetchMock = respondWith(
      JSON.stringify({
        ok: true,
        applied: ['Astro', 'CSS-Tricks'],
        sources,
        writable: true,
        warnings: [],
      }),
      { status: 200 },
    );

    await expect(
      patchRegistry('/api/sources', ['Astro', 'CSS-Tricks'], 'retire'),
    ).resolves.toEqual({
      ok: true,
      applied: ['Astro', 'CSS-Tricks'],
      items: sources,
      writable: true,
      warnings: [],
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(init.body))).toEqual({
      names: ['Astro', 'CSS-Tricks'],
      action: 'retire',
    });
  });

  it('reads the topics list for the topics endpoint', async () => {
    const topics = [{ name: 'Crypto', status: 'active' }];
    respondWith(
      JSON.stringify({ ok: true, applied: ['Crypto'], topics, warnings: [] }),
      { status: 200 },
    );

    const result = await patchRegistry('/api/topics', ['Crypto'], 'activate');

    expect(result).toMatchObject({ ok: true, items: topics });
  });

  it('passes a rejected batch through with every reason', async () => {
    const rejected = [{ name: 'Nope', reason: 'not in the registry' }];
    respondWith(
      JSON.stringify({
        error: 'Nothing was written: Nope (not in the registry).',
        rejected,
      }),
      { status: 409 },
    );

    await expect(
      patchRegistry('/api/sources', ['Astro', 'Nope'], 'retire'),
    ).resolves.toEqual({
      ok: false,
      readOnly: false,
      error: 'Nothing was written: Nope (not in the registry).',
      rejected,
    });
  });

  it('flags the read-only vault so the caller can disable its buttons', async () => {
    respondWith(
      JSON.stringify({
        error: 'The vault is mounted read-only.',
        writable: false,
      }),
      { status: 409 },
    );

    await expect(
      patchRegistry('/api/sources', ['Astro'], 'retire'),
    ).resolves.toMatchObject({ ok: false, readOnly: true, rejected: [] });
  });

  it('does not read an auth proxy’s 200 login page as success', async () => {
    respondWith('<html><body>Sign in</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });

    const result = await patchRegistry('/api/sources', ['Astro'], 'retire');

    expect(result).toMatchObject({ ok: false, readOnly: false, rejected: [] });
    expect(result.ok === false && result.error).toContain('session');
  });

  it('passes a server error through', async () => {
    respondWith(JSON.stringify({ error: 'Entry not found: Astro' }), {
      status: 500,
    });

    await expect(
      patchRegistry('/api/sources', ['Astro'], 'retire'),
    ).resolves.toEqual({
      ok: false,
      readOnly: false,
      error: 'Entry not found: Astro',
      rejected: [],
    });
  });

  it('reports the status when an error body has no message', async () => {
    respondWith(JSON.stringify({}), { status: 502 });

    await expect(
      patchRegistry('/api/topics', ['Crypto'], 'decline'),
    ).resolves.toMatchObject({
      ok: false,
      error: 'The server answered 502.',
    });
  });
});
