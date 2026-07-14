import { describe, expect, it } from 'vitest';

import { renderMarkdown } from './markdown.js';

describe('renderMarkdown', () => {
  it('renders headings by level', () => {
    expect(renderMarkdown('# Title')).toContain('<h1>Title</h1>');
    expect(renderMarkdown('## Notes')).toContain('<h2>Notes</h2>');
  });

  it('renders paragraphs, joining wrapped lines', () => {
    expect(renderMarkdown('one\ntwo')).toBe('<p>one two</p>');
  });

  it('renders unordered and ordered lists', () => {
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(renderMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>');
  });

  it('renders inline code, bold, and links (external → new tab)', () => {
    expect(renderMarkdown('run `obsidian-setup` now')).toContain(
      '<code>obsidian-setup</code>',
    );
    expect(renderMarkdown('**bold** text')).toContain('<strong>bold</strong>');
    const link = renderMarkdown('[Notion](https://example.com)');
    expect(link).toContain('href="https://example.com"');
    expect(link).toContain('target="_blank"');
  });

  it('does not let real digits collide with inline-code placeholders', () => {
    // "3 times" must survive verbatim next to an inline-code span.
    const out = renderMarkdown('use `x` 3 times');
    expect(out).toContain('<code>x</code>');
    expect(out).toContain('3 times');
  });

  it('strips HTML comments and escapes raw HTML', () => {
    expect(renderMarkdown('a <!-- hidden --> b')).not.toContain('hidden');
    expect(renderMarkdown('<script>alert(1)</script>')).toContain('&lt;script&gt;');
  });

  it('renders blockquotes', () => {
    expect(renderMarkdown('> quoted')).toBe('<blockquote>quoted</blockquote>');
  });
});
