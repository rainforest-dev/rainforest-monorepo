import * as crypto from 'node:crypto';

import { gatewayAuth } from './auth';

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

const request = (headers: Record<string, string> = {}) =>
  new Request('https://example.test/mcp', { method: 'POST', headers });

describe('gatewayAuth', () => {
  const auth = gatewayAuth({ header: 'x-gateway', secret: 'right-secret' });

  beforeEach(() => {
    vi.mocked(crypto.timingSafeEqual).mockClear();
  });

  it('accepts the right secret', async () => {
    expect(await auth(request({ 'x-gateway': 'right-secret' }))).toEqual({
      status: 'ok',
    });
  });

  it('rejects a missing header', async () => {
    expect(await auth(request())).toEqual({ status: 'unauthorized' });
  });

  it.each(['wrong-secret', 'right-secre', 'right-secret-and-more', ''])(
    'rejects %j',
    async (presented) => {
      expect(await auth(request({ 'x-gateway': presented }))).toEqual({
        status: 'unauthorized',
      });
    },
  );

  it('compares equal-length digests whatever the presented length', async () => {
    await auth(request({ 'x-gateway': 'x' }));
    await auth(request({ 'x-gateway': 'a much longer presented value' }));
    await auth(request({ 'x-gateway': 'right-secret' }));

    const calls = vi.mocked(crypto.timingSafeEqual).mock.calls;
    expect(calls).toHaveLength(3);
    for (const [a, b] of calls) {
      expect(a.byteLength).toBe(32);
      expect(b.byteLength).toBe(32);
    }
  });

  it.each([undefined, '', '   '])(
    'is disabled when the secret is %j',
    async (secret) => {
      const disabled = gatewayAuth({ header: 'x-gateway', secret });
      expect(await disabled(request({ 'x-gateway': '' }))).toEqual({
        status: 'disabled',
      });
      expect(await disabled(request({ 'x-gateway': 'anything' }))).toEqual({
        status: 'disabled',
      });
    },
  );

  describe('with userHeader', () => {
    const withUser = gatewayAuth({
      header: 'x-gateway',
      secret: 'right-secret',
      userHeader: 'x-forwarded-login',
    });

    it('returns the user for audit', async () => {
      expect(
        await withUser(
          request({
            'x-gateway': 'right-secret',
            'x-forwarded-login': 'octocat',
          }),
        ),
      ).toEqual({ status: 'ok', user: 'octocat' });
    });

    it.each<Record<string, string>>([
      {},
      { 'x-forwarded-login': '' },
      { 'x-forwarded-login': '  ' },
    ])('rejects a missing or empty user header %j', async (headers) => {
      expect(
        await withUser(request({ 'x-gateway': 'right-secret', ...headers })),
      ).toEqual({ status: 'unauthorized' });
    });

    it('rejects a wrong secret even with a user', async () => {
      expect(
        await withUser(
          request({ 'x-gateway': 'wrong', 'x-forwarded-login': 'octocat' }),
        ),
      ).toEqual({ status: 'unauthorized' });
    });
  });
});
