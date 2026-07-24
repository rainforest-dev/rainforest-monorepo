import { describe, expect, it } from 'vitest';

import { stripHtmlComments } from './html.js';

describe('stripHtmlComments', () => {
  it('removes a simple inline comment', () => {
    expect(stripHtmlComments('a <!-- hi --> b')).toBe('a  b');
  });

  it('removes comments that span newlines', () => {
    // The previous /<!--.*?-->/ left these intact, because `.` skips newlines.
    const input = 'before <!-- line one\nline two\n--> after';
    expect(stripHtmlComments(input)).toBe('before  after');
  });

  it('leaves no comment opener when removal exposes another one', () => {
    // One pass turns this into a bare `<!--`; the fixpoint loop keeps going.
    expect(stripHtmlComments('<!--<!-- -->')).not.toContain('<!--');
    expect(stripHtmlComments('x <!--<!-- --> y')).not.toContain('<!--');
  });

  it('drops an unterminated opener and everything after it', () => {
    expect(stripHtmlComments('keep <!-- never closed')).toBe('keep ');
    expect(stripHtmlComments('keep <!-- a --> mid <!-- dangling')).toBe(
      'keep  mid ',
    );
  });

  it('leaves comment-free text untouched', () => {
    const text = '## Heading\n\n- [ ] a task with `code` and a > quote';
    expect(stripHtmlComments(text)).toBe(text);
  });

  it('is idempotent', () => {
    const once = stripHtmlComments('a <!-- x --> b <!-- y --> c');
    expect(stripHtmlComments(once)).toBe(once);
  });
});
