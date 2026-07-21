/** Membership test only — a cell errors when non-empty and absent from the wordlist. */
export function isValidWord(
  word: string,
  wordlist: ReadonlySet<string>,
): boolean {
  if (word.length === 0) return true;
  return wordlist.has(word);
}

/** Split a pasted phrase on whitespace and pad/truncate to `size` cells. */
export function distributePaste(phrase: string, size: number): string[] {
  const words = phrase.trim().split(/\s+/).filter(Boolean).slice(0, size);
  return Array.from({ length: size }, (_, i) => words[i] ?? '');
}
