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
  it('sends the action and reports a write that landed', async () => {
    const fetchMock = respondWith(JSON.stringify({ ok: true }), {
      status: 200,
    });

    await expect(
      patchRegistry('/api/sources', 'Astro', 'retire'),
    ).resolves.toEqual({ ok: true });

    const [endpoint, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(endpoint).toBe('/api/sources');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'Astro',
      action: 'retire',
    });
  });

  it('does not read an auth proxy’s 200 login page as success', async () => {
    respondWith('<html><body>Sign in</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });

    const result = await patchRegistry('/api/sources', 'Astro', 'retire');

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ readOnly: false });
    expect(result.ok === false && result.error).toContain('session');
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
      patchRegistry('/api/topics', 'Home automation', 'decline'),
    ).resolves.toEqual({
      ok: false,
      readOnly: true,
      error: 'The vault is mounted read-only.',
    });
  });

  it('passes a server error through', async () => {
    respondWith(JSON.stringify({ error: 'Entry not found: Astro' }), {
      status: 500,
    });

    await expect(
      patchRegistry('/api/sources', 'Astro', 'retire'),
    ).resolves.toEqual({
      ok: false,
      readOnly: false,
      error: 'Entry not found: Astro',
    });
  });
});
