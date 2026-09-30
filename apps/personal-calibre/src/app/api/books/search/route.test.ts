import { describe, expect, it } from 'vitest';

import { querySchema } from './route';

describe('querySchema', () => {
  it('accepts a normal query', () => {
    const result = querySchema.safeParse('juniper');
    expect(result.success).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    const result = querySchema.safeParse('  juniper  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('juniper');
  });

  it('rejects a query longer than 200 characters', () => {
    const result = querySchema.safeParse('a'.repeat(201));
    expect(result.success).toBe(false);
  });

  it('accepts a query exactly 200 characters long', () => {
    const result = querySchema.safeParse('a'.repeat(200));
    expect(result.success).toBe(true);
  });
});
