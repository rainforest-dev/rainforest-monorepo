/**
 * A small, dependency-free Markdown → HTML renderer for the task-note detail
 * drawer. The notes are simple (headings, blockquotes, lists, paragraphs,
 * inline code, links, bold/italic), all authored locally in the vault, so a
 * focused renderer avoids pulling in a markdown library.
 *
 * Block structure is detected on the raw lines; text is HTML-escaped only when
 * emitted (so a note's `>`/`#`/`-` markers still parse, and any raw HTML inside
 * the text renders as inert text rather than executing).
 */

/** Remove HTML comments, leaving nothing a comment parser could still open.
 *
 * Three things a single `replace(/<!--[\s\S]*?-->/g, '')` gets wrong:
 *
 * - `<!--a--><!--` leaves the bare opener behind, because the pass consumed the
 *   one complete comment and the leftover has no terminator to match. Browsers
 *   treat an unterminated opener as commenting out everything after it, so the
 *   remainder is dropped here to match what would actually be hidden.
 * - `<!--<!--a-->-->` needs more than one pass to settle.
 * - `.` does not match a newline, so a comment spanning lines was not matched at
 *   all -- which is the one of these that was a live bug rather than a
 *   theoretical one.
 *
 * Every caller escapes its output before it reaches the DOM, so a leftover
 * opener was displayed rather than parsed. Displayed is still wrong: the point
 * of stripping these is that the reader should never see the sync markers.
 */
export function stripHtmlComments(source: string): string {
  let text = source;
  let previous: string;
  do {
    previous = text;
    text = text.replace(/<!--[\s\S]*?-->/g, '');
  } while (text !== previous);
  return text.replace(/<!--[\s\S]*$/, '');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escape, then render inline spans: code, links, bold, italic. */
function renderInline(raw: string): string {
  const text = escapeHtml(raw);

  // Inline code first, stashed behind non-colliding placeholders so its content
  // isn't re-processed by the emphasis/link passes.
  const codes: string[] = [];
  let out = text.replace(/`([^`]+)`/g, (_m, code) => {
    codes.push(`<code>${code}</code>`);
    return `@@CODE${codes.length - 1}@@`;
  });

  // Links: [text](url) — only http(s)/relative/anchor, opened safely.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
    const safe = /^(https?:|\/|#)/.test(href) ? href : '#';
    const ext = /^https?:/.test(safe);
    const attrs = ext ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${safe}"${attrs}>${label}</a>`;
  });

  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_]+)_/g, '$1<em>$2</em>');

  // Restore inline code from its placeholders.
  out = out.replace(/@@CODE(\d+)@@/g, (_m, i) => codes[Number(i)]);
  return out;
}

/** Cells of one `| a | b |` row, without the outer pipes. */
function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/** `:---` / `---:` / `:---:` → the CSS text-align it asks for, else null. */
function alignOf(spec: string): string | null {
  const left = spec.startsWith(':');
  const right = spec.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return null;
}

/** A header row at `i` whose next line is a `|---|---|` delimiter. */
function isTableStart(lines: string[], i: number): boolean {
  const header = lines[i];
  const delim = lines[i + 1];
  if (header === undefined || delim === undefined) return false;
  if (!/\|/.test(header) || header.trim() === '') return false;
  if (!/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(delim)) {
    return false;
  }
  // A delimiter that describes a different number of columns is not a table --
  // GFM requires the counts to match, and treating it as one would silently
  // drop or invent cells.
  return splitRow(header).length === splitRow(delim).length;
}

/** Render a Markdown body (frontmatter already stripped) to an HTML string. */
export function renderMarkdown(md: string): string {
  // Drop HTML comments (e.g. the managed-sync markers) — hidden in Obsidian.
  const src = stripHtmlComments(md);
  const lines = src.split('\n');

  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line → separator.
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Fenced code block.
    if (/^```/.test(line.trim())) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      html.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    // Heading.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    // Blockquote (one or more consecutive `>` lines).
    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      const inner = quote
        .filter((l) => l.trim() !== '')
        .map(renderInline)
        .join('<br>');
      html.push(`<blockquote>${inner}</blockquote>`);
      continue;
    }

    // Unordered / ordered list.
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''));
        i += 1;
      }
      const tag = ordered ? 'ol' : 'ul';
      html.push(
        `<${tag}>${items.map((it) => `<li>${renderInline(it)}</li>`).join('')}</${tag}>`,
      );
      continue;
    }

    // Table: a header row followed by a `|---|---|` delimiter. Without this the
    // rows fall through to the paragraph branch below, which joins them with a
    // space — so a table renders as one line of stray pipes.
    if (isTableStart(lines, i)) {
      const header = splitRow(lines[i]);
      const aligns = splitRow(lines[i + 1]).map(alignOf);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && lines[i].trim() !== '' && /\|/.test(lines[i])) {
        body.push(splitRow(lines[i]));
        i += 1;
      }
      const cell = (tag: string, text: string, col: number) => {
        const align = aligns[col];
        const attr = align ? ` style="text-align:${align}"` : '';
        return `<${tag}${attr}>${renderInline(text)}</${tag}>`;
      };
      const head = header.map((h, c) => cell('th', h, c)).join('');
      // Index by the header's column count so a short or over-long body row
      // cannot shift the table sideways; a missing cell renders empty.
      const rows = body
        .map(
          (r) =>
            `<tr>${header.map((_, c) => cell('td', r[c] ?? '', c)).join('')}</tr>`,
        )
        .join('');
      html.push(
        `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`,
      );
      continue;
    }

    // Paragraph: gather until a blank line or a block starter.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !/^```/.test(lines[i].trim()) &&
      !isTableStart(lines, i)
    ) {
      para.push(lines[i]);
      i += 1;
    }
    html.push(`<p>${renderInline(para.join(' '))}</p>`);
  }

  return html.join('\n');
}
