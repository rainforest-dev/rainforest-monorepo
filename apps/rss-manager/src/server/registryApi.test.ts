import { describe, expect, it } from 'vitest';

import { writeErrorResponse } from './registryApi.js';

function errno(code: string): NodeJS.ErrnoException {
  const err: NodeJS.ErrnoException = new Error(`${code}: operation failed`);
  err.code = code;
  return err;
}

describe('writeErrorResponse', () => {
  it.each(['EROFS', 'EACCES', 'EPERM'])(
    'reports %s as a read-only vault the UI can act on',
    async (code) => {
      const res = writeErrorResponse(
        errno(code),
        '/vault/RSS-Source-Registry.md',
      );

      expect(res.status).toBe(409);
      await expect(res.json()).resolves.toMatchObject({ writable: false });
    },
  );

  it('does not pass a missing file off as a read-only mount', async () => {
    const res = writeErrorResponse(
      errno('ENOENT'),
      '/vault/RSS-Source-Registry.md',
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string; writable?: boolean };
    expect(body.error).toContain('/vault/RSS-Source-Registry.md');
    expect(body.writable).toBeUndefined();
  });

  it('keeps anything else a 500', async () => {
    const res = writeErrorResponse(
      new Error('Entry not found: Astro'),
      '/vault/RSS-Source-Registry.md',
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: 'Error: Entry not found: Astro',
    });
  });
});
