/**
 * Remove HTML comments from a string, including ones that span newlines.
 *
 * Two subtleties this handles that a single `replace(/<!--.*?-->/g, '')` does not:
 *
 * 1. `.` does not match newlines, so a naive pattern silently leaves multi-line
 *    comments intact. `[\s\S]` matches across lines.
 * 2. One pass can *produce* a new comment opener: `<!--<!-- -->` becomes `<!--`
 *    once the inner comment is removed. Repeating until the string stops
 *    changing closes that hole (CodeQL: js/incomplete-multi-character-sanitization).
 *
 * Anything after an unterminated `<!--` is dropped as well — a browser would
 * swallow the rest of the document at that point anyway, so the result is
 * guaranteed never to contain a comment opener.
 */
export function stripHtmlComments(input: string): string {
  let out = input;
  let previous: string;
  do {
    previous = out;
    out = out.replace(/<!--[\s\S]*?-->/g, '');
  } while (out !== previous);
  return out.replace(/<!--[\s\S]*$/, '');
}
