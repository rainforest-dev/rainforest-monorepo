const EDGE = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;

export const trimEdges = (token: string) => token.replace(EDGE, '');

export function queryTerms(text: string): string[] {
  const terms = text
    .normalize('NFKC')
    .toLowerCase()
    .split(/\s+/u)
    .map(trimEdges)
    .filter(Boolean);
  return [...new Set(terms)];
}
