import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { addDeliveryInputSchema } from './route';

const schema = z.object(addDeliveryInputSchema);

describe('add_delivery MCP input schema', () => {
  it('accepts a missing externalRef', () => {
    expect(schema.safeParse({ bookId: 1, platformKey: 'kobo' }).success).toBe(
      true,
    );
  });

  it('accepts an https externalRef', () => {
    expect(
      schema.safeParse({
        bookId: 1,
        platformKey: 'kobo',
        externalRef: 'https://example.com/shelf/41',
      }).success,
    ).toBe(true);
  });

  it('rejects a javascript: externalRef', () => {
    expect(
      schema.safeParse({
        bookId: 1,
        platformKey: 'kobo',
        externalRef: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
  });

  it('rejects a data: externalRef', () => {
    expect(
      schema.safeParse({
        bookId: 1,
        platformKey: 'kobo',
        externalRef: 'data:text/html,<script>alert(1)</script>',
      }).success,
    ).toBe(false);
  });
});
