import { mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server/store.ts', () => ({
  dataDir: () => '/data',
  getTimeline: () => ({ status: 'ready' }),
  mediaFile: (_state: unknown, _root: unknown, id: string) =>
    id === 'GONE' ? join(root, 'evicted.jpeg') : srcPath,
  localFile: async (path: string) => {
    try {
      return statSync(path);
    } catch {
      return undefined;
    }
  },
}));

vi.mock('@/lib/server/thumbs.ts', () => ({
  NOT_LOCAL_SVG: '<svg/>',
  ensureThumb: () => Promise.reject(new Error('sharp cannot decode source')),
  parseWidth: () => 480,
  thumbCacheDir: () => '/cache',
  thumbPath: () => join(tmpdir(), 'thumb-encode-failure-dest.webp'),
}));

const root = mkdtempSync(join(tmpdir(), 'memories-thumb-route-'));
const srcPath = join(root, 'undecodable.heic');
writeFileSync(srcPath, Buffer.from('not a real image'));

const { GET } = await import('@/pages/thumb/[id].ts');

describe('GET /thumb/[id]', () => {
  it('redirects to /media/<id> when the source cannot be encoded', async () => {
    const response = await GET({
      params: { id: 'P1' },
      url: new URL('http://localhost/thumb/P1?n=0&w=480'),
    } as never);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/media/P1');
  });

  it('carries the photo index into the redirect when n > 0', async () => {
    const response = await GET({
      params: { id: 'P1' },
      url: new URL('http://localhost/thumb/P1?n=2&w=480'),
    } as never);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/media/P1?n=2');
  });

  it('answers with a placeholder when the file is no longer on disk', async () => {
    const response = await GET({
      params: { id: 'GONE' },
      url: new URL('http://localhost/thumb/GONE?n=0&w=480'),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(response.headers.get('X-Memories-Media')).toBe('not-local');
  });
});
