import { describe, expect, it } from 'vitest';

import type { RawSearchParams } from './library-params';
import { applyTestHooks, NO_HOOKS, readTestHooks } from './test-hooks';

describe('readTestHooks', () => {
  it('reads nothing unless CALIBRE_E2E is on', () => {
    expect(
      readTestHooks(
        { __fault: 'list', __delay: '500', __pageSize: '250' },
        'pane',
        false,
      ),
    ).toEqual(NO_HOOKS);
  });

  it.each<[string, RawSearchParams, string | undefined]>([
    ['no params, no cookie', {}, undefined],
    ['__fault only', { __fault: 'list' }, undefined],
    ['__delay only', { __delay: '500' }, undefined],
    ['__pageSize only', { __pageSize: '100' }, undefined],
    ['cookie only', {}, 'pane'],
    [
      'every param and the cookie',
      { __fault: 'list', __delay: '500', __pageSize: '100' },
      'pane',
    ],
  ])('%s -> NO_HOOKS when disabled', (_label, params, cookie) => {
    expect(readTestHooks(params, cookie, false)).toEqual(NO_HOOKS);
  });

  it('reads the fault, delay and page size', () => {
    expect(
      readTestHooks(
        { __fault: 'list', __delay: '500', __pageSize: '100' },
        undefined,
        true,
      ),
    ).toEqual({
      fault: 'list',
      delayMs: 500,
      pageSize: 100,
    });
  });

  it('reads a fault from the cookie when the URL has none', () => {
    expect(readTestHooks({}, 'pane', true).fault).toBe('pane');
  });

  it('clamps and ignores bad values', () => {
    expect(
      readTestHooks({ __delay: '999999', __pageSize: '999' }, undefined, true),
    ).toMatchObject({
      delayMs: 10_000,
      pageSize: 250,
    });
    expect(
      readTestHooks(
        { __fault: 'disk', __delay: 'abc', __pageSize: '0' },
        'nope',
        true,
      ),
    ).toEqual(NO_HOOKS);
  });
});

describe('applyTestHooks', () => {
  it('throws only for the matching scope', async () => {
    await expect(
      applyTestHooks({ ...NO_HOOKS, fault: 'list' }, 'list'),
    ).rejects.toThrow('Injected list fault');
    await expect(
      applyTestHooks({ ...NO_HOOKS, fault: 'list' }, 'pane'),
    ).resolves.toBeUndefined();
  });
});
