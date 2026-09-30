import { describe, expect, it } from 'vitest';

import { bulkDeliveryBodySchema } from './route';

describe('bulkDeliveryBodySchema', () => {
  it('accepts a non-empty bookIds array with a platformKey', () => {
    const result = bulkDeliveryBodySchema.safeParse({
      bookIds: [1, 2, 3],
      platformKey: 'kobo',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty bookIds array', () => {
    const result = bulkDeliveryBodySchema.safeParse({
      bookIds: [],
      platformKey: 'kobo',
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 1000 bookIds', () => {
    const result = bulkDeliveryBodySchema.safeParse({
      bookIds: Array.from({ length: 1001 }, (_, i) => i + 1),
      platformKey: 'kobo',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer bookIds', () => {
    const result = bulkDeliveryBodySchema.safeParse({
      bookIds: [1, 2.5],
      platformKey: 'kobo',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing platformKey', () => {
    const result = bulkDeliveryBodySchema.safeParse({ bookIds: [1] });
    expect(result.success).toBe(false);
  });

  it('rejects a javascript: externalRef', () => {
    const result = bulkDeliveryBodySchema.safeParse({
      bookIds: [1],
      platformKey: 'kobo',
      externalRef: 'javascript:alert(1)',
    });
    expect(result.success).toBe(false);
  });
});
