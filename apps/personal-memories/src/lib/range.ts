export type ParsedRange = { start: number; end: number };
export type RangeResult = ParsedRange | 'unsatisfiable' | undefined;

const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/;

export function parseRange(
  header: string | null | undefined,
  size: number,
): RangeResult {
  if (!header) return undefined;
  const match = SINGLE_RANGE.exec(header.trim());
  if (!match) return undefined;
  const [, startStr, endStr] = match;
  if (!startStr && !endStr) return undefined;
  if (size <= 0) return 'unsatisfiable';

  let start: number;
  let end: number;
  if (!startStr) {
    const suffixLength = Number(endStr);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0)
      return 'unsatisfiable';
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(startStr);
    end = endStr ? Number(endStr) : size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'unsatisfiable';
  if (start > end || start >= size) return 'unsatisfiable';
  return { start, end: Math.min(end, size - 1) };
}
