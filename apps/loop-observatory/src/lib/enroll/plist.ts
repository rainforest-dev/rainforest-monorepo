// apps/loop-observatory/src/lib/enroll/plist.ts

/**
 * Serialise a plain object to a launchd plist.
 *
 * Hand-written by design rather than reached for from a library: the output is
 * compared against files macOS already loads, so controlling the exact shape
 * matters more than generality.
 */
export type PlistValue =
  | string
  | number
  | boolean
  | PlistValue[]
  | { [k: string]: PlistValue };

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ESCAPES[c] ?? c);
}

/**
 * XML forbids `--` inside a comment. `plutil` accepts it anyway and Python's
 * expat refuses the whole file, which is exactly the state the committed
 * `Angibles-MacBook-Air.tools.rainforest.loop-ralph.plist` is in: it carries
 * `probed 2026-08-25 -- DENIED here`, loads fine under launchd, and cannot be
 * read by a standards-conforming parser. Generated files must not inherit that,
 * so the sequence is rewritten rather than rejected — a comment explaining a
 * decision is worth more than a build failure over punctuation.
 */
function safeComment(text: string): string {
  return text.replace(/--+/g, '—');
}

function render(value: PlistValue, indent: string): string {
  if (typeof value === 'string')
    return `${indent}<string>${esc(value)}</string>\n`;
  if (typeof value === 'boolean')
    return `${indent}${value ? '<true/>' : '<false/>'}\n`;
  if (typeof value === 'number') {
    // `<integer>` is the only numeric plist tag this serialiser emits. The
    // only numbers it carries are launchd intervals (StartInterval,
    // ThrottleInterval), where a fractional value is a caller bug rather than
    // a value worth encoding faithfully — emitting `<real>` would hand
    // launchd something it may silently round or reject. Refuse instead of
    // guessing, matching the rest of this codebase.
    if (!Number.isInteger(value)) {
      throw new Error(
        `toPlist: expected an integer, got ${value} (plist <integer> cannot represent fractional values; use a whole number)`,
      );
    }
    return `${indent}<integer>${value}</integer>\n`;
  }
  if (Array.isArray(value)) {
    const inner = value.map((v) => render(v, `${indent}  `)).join('');
    return `${indent}<array>\n${inner}${indent}</array>\n`;
  }
  const inner = Object.entries(value)
    .map(
      ([k, v]) =>
        `${indent}  <key>${esc(k)}</key>\n${render(v, `${indent}  `)}`,
    )
    .join('');
  return `${indent}<dict>\n${inner}${indent}</dict>\n`;
}

export function toPlist(
  obj: PlistValue,
  comments: Record<string, string> = {},
): string {
  let body: string;
  if (!Array.isArray(obj) && typeof obj === 'object') {
    const inner = Object.entries(obj)
      .map(([k, v]) => {
        const note = comments[k]
          ? `  <!-- ${safeComment(comments[k])} -->\n`
          : '';
        return `${note}  <key>${esc(k)}</key>\n${render(v, '  ')}`;
      })
      .join('');
    body = `<dict>\n${inner}</dict>\n`;
  } else {
    body = render(obj, '');
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ' +
    '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
    `<plist version="1.0">\n${body}</plist>\n`
  );
}
