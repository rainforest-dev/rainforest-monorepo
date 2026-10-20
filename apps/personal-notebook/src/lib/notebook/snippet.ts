export interface SnippetPart {
  text: string;
  match: boolean;
}

const BEFORE = 40;
const LENGTH = 160;

/**
 * A short excerpt of `text` around the first of `terms` it contains, split so the matches can be
 * marked. Without a match it is the start of the text. Line breaks read as spaces.
 */
export function pageSnippet(
  text: string,
  terms: readonly string[],
): SnippetPart[] {
  const flat = text.replace(/\s+/g, ' ').trim();
  const lower = flat.toLowerCase();
  const wanted = terms.map((term) => term.toLowerCase()).filter(Boolean);
  const first = Math.min(
    ...wanted.map((term) => lower.indexOf(term)).filter((i) => i >= 0),
  );
  const start = Number.isFinite(first) ? Math.max(0, first - BEFORE) : 0;
  const end = Math.min(flat.length, start + LENGTH);

  const parts: SnippetPart[] = [];
  const push = (from: number, to: number, match: boolean) => {
    if (to > from) parts.push({ text: flat.slice(from, to), match });
  };
  let at = start;
  while (at < end) {
    let next = -1;
    let size = 0;
    for (const term of wanted) {
      const i = lower.indexOf(term, at);
      if (i >= 0 && i < end && (next === -1 || i < next)) {
        next = i;
        size = term.length;
      }
    }
    if (next === -1) break;
    push(at, next, false);
    push(next, Math.min(end, next + size), true);
    at = next + size;
  }
  push(at, end, false);
  if (start > 0) parts.unshift({ text: '…', match: false });
  if (end < flat.length) parts.push({ text: '…', match: false });
  return parts;
}
