const SNIPPET_CHARS = 80;

export function contentHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export const clipSnippet = (s: string) =>
  Array.from(s).slice(0, SNIPPET_CHARS).join('');
