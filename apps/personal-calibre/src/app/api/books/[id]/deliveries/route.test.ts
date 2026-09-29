import { describe, expect, it } from 'vitest';

import { deliveryBodySchema } from './route';

describe('deliveryBodySchema', () => {
  it('accepts a platformKey with no note or externalRef', () => {
    const result = deliveryBodySchema.safeParse({ platformKey: 'kobo' });
    expect(result.success).toBe(true);
  });

  it('treats an empty externalRef as absent', () => {
    const result = deliveryBodySchema.safeParse({
      platformKey: 'kobo',
      externalRef: '',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.externalRef).toBeUndefined();
  });

  it('accepts an https externalRef', () => {
    const result = deliveryBodySchema.safeParse({
      platformKey: 'kobo',
      externalRef: 'https://example.com/shelf/41',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing platformKey', () => {
    expect(deliveryBodySchema.safeParse({}).success).toBe(false);
  });

  it('rejects a blank platformKey', () => {
    expect(deliveryBodySchema.safeParse({ platformKey: '   ' }).success).toBe(
      false,
    );
  });

  it('rejects a javascript: externalRef', () => {
    const result = deliveryBodySchema.safeParse({
      platformKey: 'kobo',
      externalRef: 'javascript:alert(1)',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a data: externalRef', () => {
    const result = deliveryBodySchema.safeParse({
      platformKey: 'kobo',
      externalRef: 'data:text/html,<script>alert(1)</script>',
    });
    expect(result.success).toBe(false);
  });
});
