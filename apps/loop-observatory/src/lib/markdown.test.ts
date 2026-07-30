import { describe, expect, it } from 'vitest';

import { renderMarkdown, stripHtmlComments } from './markdown.js';

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

  it('renders a table instead of flattening it into a paragraph', () => {
    // The regression: with no table branch these lines fell through to the
    // paragraph gatherer, which joins with a space — so the execution-plan
    // block in a task note rendered as one run of stray pipes.
    const html = renderMarkdown(
      ['| a | b |', '|---|---|', '| 1 | 2 |'].join('\n'),
    );
    expect(html).toBe(
      '<table><thead><tr><th>a</th><th>b</th></tr></thead>' +
        '<tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
    );
    expect(html).not.toContain('<p>');
  });

  it('renders inline spans inside cells', () => {
    const html = renderMarkdown(
      ['| model | pool |', '|---|---|', '| `opus-5` | **claude** |'].join('\n'),
    );
    expect(html).toContain('<td><code>opus-5</code></td>');
    expect(html).toContain('<td><strong>claude</strong></td>');
  });

  it('honours column alignment markers', () => {
    const html = renderMarkdown(
      ['| l | c | r |', '|:---|:---:|---:|', '| 1 | 2 | 3 |'].join('\n'),
    );
    expect(html).toContain('<th style="text-align:left">l</th>');
    expect(html).toContain('<th style="text-align:center">c</th>');
    expect(html).toContain('<th style="text-align:right">r</th>');
  });

  it('pads a short row rather than shifting the table sideways', () => {
    const html = renderMarkdown(
      ['| a | b | c |', '|---|---|---|', '| 1 |'].join('\n'),
    );
    expect(html).toContain('<tr><td>1</td><td></td><td></td></tr>');
  });

  it('ends the table at a blank line and keeps later blocks separate', () => {
    const html = renderMarkdown(
      ['| a |', '|---|', '| 1 |', '', 'after'].join('\n'),
    );
    expect(html).toContain('</table>');
    expect(html).toContain('<p>after</p>');
  });

  it('ends a paragraph when a table starts on the next line', () => {
    expect(
      renderMarkdown(['intro', '| a |', '|---|', '| 1 |'].join('\n')),
    ).toBe(
      '<p>intro</p>\n<table><thead><tr><th>a</th></tr></thead>' +
        '<tbody><tr><td>1</td></tr></tbody></table>',
    );
  });

  it('leaves pipe text alone when the delimiter does not match', () => {
    // Pipes with no delimiter row are prose, not a table.
    expect(renderMarkdown('a | b\nc | d')).toBe('<p>a | b c | d</p>');
    // Disagreeing column counts are not a GFM table either.
    expect(renderMarkdown('| a | b |\n|---|\n| 1 | 2 |')).toContain('<p>');
  });

  it('escapes cell content', () => {
    expect(renderMarkdown('| x |\n|---|\n| <img src=q> |')).toContain(
      '<td>&lt;img src=q&gt;</td>',
    );
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
    expect(renderMarkdown('<script>alert(1)</script>')).toContain(
      '&lt;script&gt;',
    );
  });

  it('renders blockquotes', () => {
    expect(renderMarkdown('> quoted')).toBe('<blockquote>quoted</blockquote>');
  });
});

describe('stripHtmlComments', () => {
  it('removes a plain comment', () => {
    expect(stripHtmlComments('a<!--x-->b')).toBe('ab');
  });

  it('removes a comment spanning lines', () => {
    // The old `.` never matched across a newline, so multi-line sync markers
    // survived into the rendered output.
    expect(stripHtmlComments('a<!--\nx\n-->b')).toBe('ab');
  });

  it('leaves nothing that could still open a comment', () => {
    // One pass consumed `<!--a-->` and left the second opener behind, with no
    // terminator for it to match.
    expect(stripHtmlComments('a<!--x--><!--')).toBe('a');
    expect(stripHtmlComments('<!--')).toBe('');
  });

  it('settles when comments nest', () => {
    expect(stripHtmlComments('<!--<!--x-->-->')).not.toContain('<!--');
  });

  it('drops everything after an unterminated opener, as a parser would', () => {
    expect(stripHtmlComments('keep<!--then all of this')).toBe('keep');
  });

  it('leaves text with no comments untouched', () => {
    expect(stripHtmlComments('a > b && c < d')).toBe('a > b && c < d');
  });

  it('is what renderMarkdown uses, so markers never reach the output', () => {
    expect(renderMarkdown('before <!--marker--> after')).toBe(
      '<p>before  after</p>',
    );
  });
});
