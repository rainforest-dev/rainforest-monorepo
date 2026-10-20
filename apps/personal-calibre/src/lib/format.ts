import type { LibraryT } from '@rainforest-dev/library-shell';

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function seriesLine(
  series: string,
  index: number | null,
  t: LibraryT,
): string {
  if (index === null) return series;
  return t('series.line', { series, index: String(index) });
}

export function yearOf(pubdate: string | null): string | null {
  const year = pubdate ? Number(pubdate.slice(0, 4)) : NaN;
  return Number.isFinite(year) && year >= 1000 ? String(year) : null;
}
