const EDGE = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;

export const fold = (s: string) => s.normalize('NFKC').toLowerCase();

export const trimEdges = (token: string) => token.replace(EDGE, '');

export function queryTerms(text: string): string[] {
  const terms = fold(text).split(/\s+/u).map(trimEdges).filter(Boolean);
  return [...new Set(terms)];
}

export function whitespaceTerms(text: string): string[] {
  return [...new Set(fold(text).split(/\s+/u).filter(Boolean))];
}
