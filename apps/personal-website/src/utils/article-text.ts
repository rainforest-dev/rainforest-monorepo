/**
 * Reduces an MDX post body to the prose a summarizer should actually see.
 *
 * Written after watching the real model echo an article's source back verbatim — imports, JSX
 * tags and all — as its "summary". The posts here are MDX: they carry `import` statements, Astro
 * island tags, and expression comments that are not prose in any sense, and a summarizer handed
 * them will faithfully summarize the markup.
 *
 * Deliberately not a markdown parser. This runs in the browser on every post, and the goal is to
 * drop the constructs that mislead a summarizer, not to render anything.
 */
export function toProse(body: string): string {
  return (
    body
      // frontmatter, when the body still carries its fence
      .replace(/^---\n[\s\S]*?\n---\n/, '')
      // fenced code: the least summarizable, most token-expensive part of a technical post
      .replace(/```[\s\S]*?```/g, '')
      // MDX expression comments, e.g. {/* <WebLLM client:load /> */}
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      // ES imports/exports at the top of an MDX file
      .replace(/^\s*(?:import|export)\s.*$/gm, '')
      // JSX/Astro island tags, self-closing or paired. Paired first so the inner text survives:
      // <Note>real prose</Note> should keep "real prose".
      .replace(/<([A-Z][\w.]*)\b[^>]*>([\s\S]*?)<\/\1>/g, '$2')
      .replace(/<[A-Z][\w.]*\b[^>]*\/>/g, '')
      // inline code ticks and heading/emphasis markers: keep the words, drop the syntax
      .replace(/`([^`]*)`/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      // markdown links -> their text
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * Below this many characters of prose there is nothing worth summarizing, and asking anyway
 * produces the echo described above. `web-ai.mdx` is the motivating case: almost entirely headings
 * and live demo components, so it reduces to a few dozen characters.
 *
 * Chosen as roughly a long paragraph — short enough to admit a brief post, long enough that a
 * summary is a genuine reduction rather than a restatement.
 */
export const MIN_PROSE_CHARS = 600;

/** Whether a post has enough prose that summarizing it is meaningful. */
export function isSummarizable(body: string): boolean {
  return toProse(body).length >= MIN_PROSE_CHARS;
}

/**
 * Splits a markdown key-points summary into plain-text bullets.
 *
 * The model is asked for markdown and returns `* item` lines with `**bold**` and `` `code` ``
 * inside. Rendering that string raw shows the punctuation to the reader; rendering it as HTML
 * would hand an unreviewed generator a path into the page. So the structure is parsed here and
 * each bullet is interpolated as text — the list is ours, only the words are the model's.
 *
 * Anything that is not a bullet list survives as a single entry, so a `tldr`-style paragraph
 * still renders.
 */
export function toBullets(summary: string): string[] {
  const clean = (line: string) =>
    line
      .replace(/^\s*[*-]\s+/, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/`([^`]*)`/g, '$1')
      .trim();

  const lines = summary
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const bullets = lines.filter((line) => /^\s*[*-]\s+/.test(line));
  return (bullets.length ? bullets : lines).map(clean).filter(Boolean);
}
