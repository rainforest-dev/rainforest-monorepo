import { describe, expect, it, vi } from 'vitest';

import type { LinkPreview } from '@/lib/links.ts';

import {
  checkUrl,
  fetchPreview,
  handleLinkPreview,
  isPrivateAddress,
  isPublicDestination,
  parsePreview,
  previewCache,
} from './link-preview.ts';

const PUBLIC = async () => ['93.184.216.34'];

const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });

const redirect = (location: string, status = 302) =>
  new Response(null, { status, headers: { location } });

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::',
    '::1',
    'fe80::1',
    'fc00::1',
    'fd12:3456::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:a9fe:a9fe',
    '64:ff9b::a00:1',
    'not-an-ip',
  ])('blocks %s', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '172.32.0.1',
    '93.184.216.34',
    '2606:4700::1111',
    '::ffff:8.8.8.8',
  ])('allows %s', (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});

describe('checkUrl', () => {
  it.each([
    'ftp://example.com/',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'http://localhost:3004/',
    'http://foo.localhost/',
    'http://printer.local/',
    'http://intranet/',
    'http://127.0.0.1/',
    'http://2130706433/',
    'http://0x7f.1/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://169.254.169.254/latest/meta-data',
    'http://user:pass@example.com/',
    `https://example.com/${'a'.repeat(3000)}`,
    'not a url',
  ])('rejects %s', (raw) => {
    expect(checkUrl(raw)).toBeUndefined();
  });

  it('accepts public http(s) URLs', () => {
    expect(checkUrl('https://example.com/a?b=1')?.href).toBe(
      'https://example.com/a?b=1',
    );
    expect(checkUrl('http://8.8.8.8/')?.href).toBe('http://8.8.8.8/');
  });
});

describe('isPublicDestination', () => {
  it('rejects hostnames that resolve to a private address', async () => {
    const url = new URL('https://rebind.example.com/');
    expect(await isPublicDestination(url, async () => ['10.0.0.5'])).toBe(
      false,
    );
    expect(await isPublicDestination(url, async () => ['8.8.8.8', '::1'])).toBe(
      false,
    );
    expect(await isPublicDestination(url, async () => [])).toBe(false);
    expect(
      await isPublicDestination(url, async () => {
        throw new Error('ENOTFOUND');
      }),
    ).toBe(false);
    expect(await isPublicDestination(url, PUBLIC)).toBe(true);
  });
});

describe('parsePreview', () => {
  it('reads Open Graph tags regardless of attribute order', () => {
    const page = `<!doctype html><html><head>
      <title>Fallback</title>
      <meta content="OG &amp; title" property="og:title">
      <meta property='og:description' content='第一行
        第二行'>
      <meta property="og:image" content="/img/cover.jpg" />
      <meta property="og:site_name" content="Example">
    </head><body><meta property="og:title" content="ignored"></body></html>`;
    expect(parsePreview(page, 'https://example.com/post/1')).toEqual({
      url: 'https://example.com/post/1',
      title: 'OG & title',
      description: '第一行 第二行',
      image: 'https://example.com/img/cover.jpg',
      siteName: 'Example',
    });
  });

  it('falls back to <title> and meta description', () => {
    const page =
      '<head><title> Plain &#x4E2D;&#25991; </title><meta name="description" content="desc"></head>';
    expect(parsePreview(page, 'https://example.com/')).toEqual({
      url: 'https://example.com/',
      title: 'Plain 中文',
      description: 'desc',
    });
  });

  it('drops images that are not public http(s)', () => {
    const page =
      '<head><title>t</title><meta property="og:image" content="javascript:alert(1)"><meta name="twitter:image" content="x"></head>';
    expect(parsePreview(page, 'https://example.com/').image).toBeUndefined();
    const local =
      '<head><title>t</title><meta property="og:image" content="http://192.168.0.1/a.png"></head>';
    expect(parsePreview(local, 'https://example.com/').image).toBeUndefined();
  });

  it('returns only the url when nothing is found', () => {
    expect(parsePreview('<p>hi</p>', 'https://example.com/')).toEqual({
      url: 'https://example.com/',
    });
  });
});

describe('fetchPreview', () => {
  it('fetches and parses a page', async () => {
    const fetchMock = vi.fn(async () =>
      html('<head><meta property="og:title" content="Hello"></head>'),
    );
    const preview = await fetchPreview('https://example.com/', {
      fetch: fetchMock as unknown as typeof fetch,
      lookup: PUBLIC,
    });
    expect(preview).toEqual({ url: 'https://example.com/', title: 'Hello' });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://example.com/'),
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('follows redirects and resolves relative images against the final URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirect('/moved'))
      .mockResolvedValueOnce(
        html(
          '<head><title>Moved</title><meta property="og:image" content="pic.png"></head>',
        ),
      );
    const preview = await fetchPreview('https://example.com/a/start', {
      fetch: fetchMock as unknown as typeof fetch,
      lookup: PUBLIC,
    });
    expect(preview).toEqual({
      url: 'https://example.com/a/start',
      title: 'Moved',
      image: 'https://example.com/pic.png',
    });
  });

  it('refuses a redirect to a private host', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirect('http://169.254.169.254/latest'));
    const preview = await fetchPreview('https://example.com/', {
      fetch: fetchMock as unknown as typeof fetch,
      lookup: PUBLIC,
    });
    expect(preview).toEqual({ url: 'https://example.com/' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('re-checks DNS on every hop', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirect('https://evil.example.net/'));
    const lookup = vi.fn(async (host: string) =>
      host === 'evil.example.net' ? ['127.0.0.1'] : ['93.184.216.34'],
    );
    const preview = await fetchPreview('https://example.com/', {
      fetch: fetchMock as unknown as typeof fetch,
      lookup,
    });
    expect(preview).toEqual({ url: 'https://example.com/' });
    expect(lookup).toHaveBeenCalledWith('evil.example.net');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after three redirects', async () => {
    const fetchMock = vi.fn(async () => redirect('https://example.com/loop'));
    const preview = await fetchPreview('https://example.com/', {
      fetch: fetchMock as unknown as typeof fetch,
      lookup: PUBLIC,
    });
    expect(preview).toEqual({ url: 'https://example.com/' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('never fetches a private destination', async () => {
    const fetchMock = vi.fn();
    const preview = await fetchPreview('https://internal.example.com/', {
      fetch: fetchMock as unknown as typeof fetch,
      lookup: async () => ['192.168.1.10'],
    });
    expect(preview).toEqual({ url: 'https://internal.example.com/' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores non-HTML and error responses', async () => {
    for (const response of [
      new Response('{}', { headers: { 'content-type': 'application/json' } }),
      new Response('<title>Nope</title>', {
        status: 500,
        headers: { 'content-type': 'text/html' },
      }),
    ]) {
      const preview = await fetchPreview('https://example.com/', {
        fetch: (async () => response) as unknown as typeof fetch,
        lookup: PUBLIC,
      });
      expect(preview).toEqual({ url: 'https://example.com/' });
    }
  });

  it('stops reading at the byte cap', async () => {
    const head = '<head><title>Capped</title></head>';
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(
          new TextEncoder().encode(pulled === 1 ? head : 'x'.repeat(1024)),
        );
      },
    });
    const preview = await fetchPreview('https://example.com/', {
      fetch: (async () =>
        new Response(body, {
          headers: { 'content-type': 'text/html' },
        })) as unknown as typeof fetch,
      lookup: PUBLIC,
      maxBytes: 4096,
    });
    expect(preview.title).toBe('Capped');
    expect(pulled).toBeLessThan(10);
  });

  it('decodes a charset declared only in the page', async () => {
    const bytes = new Uint8Array([
      ...new TextEncoder().encode('<head><meta charset="big5"><title>'),
      0xa4,
      0xa4,
      0xa4,
      0xe5,
      ...new TextEncoder().encode('</title></head>'),
    ]);
    const preview = await fetchPreview('https://example.com/', {
      fetch: (async () =>
        new Response(bytes, {
          headers: { 'content-type': 'text/html' },
        })) as unknown as typeof fetch,
      lookup: PUBLIC,
    });
    expect(preview.title).toBe('中文');
  });

  it('returns a failure when the fetch throws or times out', async () => {
    const preview = await fetchPreview('https://example.com/', {
      fetch: ((_: unknown, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason),
          );
        })) as unknown as typeof fetch,
      lookup: PUBLIC,
      timeoutMs: 10,
    });
    expect(preview).toEqual({ url: 'https://example.com/' });
  });
});

describe('previewCache', () => {
  it('dedupes requests and keeps successes for the long TTL', async () => {
    let clock = 0;
    const load = vi.fn(async (url: string): Promise<LinkPreview> => ({
      url,
      title: 't',
    }));
    const cache = previewCache({
      load,
      now: () => clock,
      ttlMs: 1000,
      failureTtlMs: 10,
    });
    await Promise.all([cache.get('a'), cache.get('a')]);
    expect(load).toHaveBeenCalledTimes(1);
    clock = 500;
    await cache.get('a');
    expect(load).toHaveBeenCalledTimes(1);
    clock = 1500;
    await cache.get('a');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps failures only briefly', async () => {
    let clock = 0;
    const load = vi.fn(async (url: string): Promise<LinkPreview> => ({ url }));
    const cache = previewCache({
      load,
      now: () => clock,
      ttlMs: 1000,
      failureTtlMs: 10,
    });
    await cache.get('a');
    clock = 5;
    await cache.get('a');
    expect(load).toHaveBeenCalledTimes(1);
    clock = 20;
    await cache.get('a');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('evicts the least recently used entry past the limit', async () => {
    const load = vi.fn(async (url: string): Promise<LinkPreview> => ({
      url,
      title: url,
    }));
    const cache = previewCache({ load, max: 2 });
    await cache.get('a');
    await cache.get('b');
    await cache.get('a');
    await cache.get('c');
    load.mockClear();
    await cache.get('a');
    expect(load).not.toHaveBeenCalled();
    await cache.get('b');
    expect(load).toHaveBeenCalledWith('b');
  });
});

describe('handleLinkPreview', () => {
  const cache = { get: vi.fn(async (url: string) => ({ url, title: 'T' })) };

  it('rejects a missing or unsafe url with 400', async () => {
    for (const query of ['', '?url=', '?url=http%3A%2F%2F127.0.0.1%2F']) {
      const response = await handleLinkPreview(
        new URL(`http://memories.test/link-preview.json${query}`),
        cache,
      );
      expect(response.status).toBe(400);
    }
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('returns the cached preview as JSON', async () => {
    const response = await handleLinkPreview(
      new URL(
        `http://memories.test/link-preview.json?url=${encodeURIComponent('https://example.com/a')}`,
      ),
      cache,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      url: 'https://example.com/a',
      title: 'T',
    });
  });
});
