export { fnv1a as contentHash } from '@rainforest-dev/search';

const SNIPPET_CHARS = 80;

export const clipSnippet = (s: string) =>
  Array.from(s).slice(0, SNIPPET_CHARS).join('');
