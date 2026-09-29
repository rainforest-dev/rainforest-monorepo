import { describe, expect, it } from 'vitest';

import { safeExternalHref } from './url';

describe('safeExternalHref', () => {
  it('keeps an http URL', () => {
    expect(safeExternalHref('http://example.com/shelf/41')).toBe(
      'http://example.com/shelf/41',
    );
  });

  it('keeps an https URL', () => {
    expect(safeExternalHref('https://example.com/shelf/41')).toBe(
      'https://example.com/shelf/41',
    );
  });

  it('rejects a javascript: URL', () => {
    expect(safeExternalHref('javascript:alert(1)')).toBeUndefined();
  });

  it('rejects a javascript: URL regardless of case', () => {
    expect(safeExternalHref('JaVaScRiPt:alert(1)')).toBeUndefined();
  });

  it('rejects a data: URL', () => {
    expect(
      safeExternalHref('data:text/html,<script>alert(1)</script>'),
    ).toBeUndefined();
  });

  it('rejects a whitespace-prefixed javascript: URL', () => {
    expect(safeExternalHref('   javascript:alert(1)')).toBeUndefined();
  });

  it('rejects a relative path', () => {
    expect(safeExternalHref('/shelf/41')).toBeUndefined();
  });

  it('rejects an empty value', () => {
    expect(safeExternalHref('')).toBeUndefined();
    expect(safeExternalHref(null)).toBeUndefined();
    expect(safeExternalHref(undefined)).toBeUndefined();
  });
});
