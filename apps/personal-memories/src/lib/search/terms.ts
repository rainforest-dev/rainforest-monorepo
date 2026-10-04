const EDGE = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;

export function queryTerms(text: string): string[] {
  const terms = text
    .normalize('NFKC')
    .toLowerCase()
    .split(/\s+/u)
    .map((t) => t.replace(EDGE, ''))
    .filter(Boolean);
  return [...new Set(terms)];
}
