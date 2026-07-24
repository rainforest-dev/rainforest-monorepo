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

import { stripHtmlComments } from './html.js';

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
      const inner = quote.filter((l) => l.trim() !== '').map(renderInline).join('<br>');
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

    // Paragraph: gather until a blank line or a block starter.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !/^```/.test(lines[i].trim())
    ) {
      para.push(lines[i]);
      i += 1;
    }
    html.push(`<p>${renderInline(para.join(' '))}</p>`);
  }

  return html.join('\n');
}
