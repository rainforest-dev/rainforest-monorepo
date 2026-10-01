import { describe, expect, it } from 'vitest';

import {
  bulkCreateDeliveryEvents,
  createBookDeliveryEvent,
  normalizeExternalRef,
} from './delivery';

describe('normalizeExternalRef', () => {
  it('normalizes a blank value to null', () => {
    expect(normalizeExternalRef(undefined)).toBeNull();
    expect(normalizeExternalRef('')).toBeNull();
    expect(normalizeExternalRef('   ')).toBeNull();
  });

  it('keeps a trimmed http(s) URL', () => {
    expect(normalizeExternalRef(' https://example.com/shelf/41 ')).toBe(
      'https://example.com/shelf/41',
    );
  });

  it('rejects a javascript: URL', () => {
    expect(() => normalizeExternalRef('javascript:alert(1)')).toThrow(
      /http or https/,
    );
  });

  it('rejects a data: URL', () => {
    expect(() =>
      normalizeExternalRef('data:text/html,<script>alert(1)</script>'),
    ).toThrow(/http or https/);
  });
});

describe('createBookDeliveryEvent', () => {
  it('rejects a javascript: externalRef before touching the database', async () => {
    await expect(
      createBookDeliveryEvent(1, {
        platformKey: 'kobo',
        externalRef: 'javascript:alert(1)',
      }),
    ).rejects.toThrow(/http or https/);
  });
});

describe('bulkCreateDeliveryEvents', () => {
  it('rejects a javascript: externalRef before touching the database', async () => {
    await expect(
      bulkCreateDeliveryEvents([1, 2], {
        platformKey: 'kobo',
        externalRef: 'javascript:alert(1)',
      }),
    ).rejects.toThrow(/http or https/);
  });
});
