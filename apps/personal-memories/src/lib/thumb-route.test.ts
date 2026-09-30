import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('./store.ts', () => ({
  dataDir: () => '/data',
  getTimeline: () => ({ status: 'ready' }),
  mediaFile: () => srcPath,
}));

vi.mock('./thumbs.ts', () => ({
  ensureThumb: () => Promise.reject(new Error('sharp cannot decode source')),
  parseWidth: () => 480,
  thumbCacheDir: () => '/cache',
  thumbPath: () => join(tmpdir(), 'thumb-encode-failure-dest.webp'),
}));

const root = mkdtempSync(join(tmpdir(), 'memories-thumb-route-'));
const srcPath = join(root, 'undecodable.heic');
writeFileSync(srcPath, Buffer.from('not a real image'));

const { GET } = await import('../pages/thumb/[id].ts');

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
});
