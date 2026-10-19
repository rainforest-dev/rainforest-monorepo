const DAY_MS = 86_400_000;

export function daysAgo(date: string, now = Date.now()): string | null {
  const time = new Date(date).getTime();
  if (Number.isNaN(time)) return null;
  const days = Math.max(0, Math.floor((now - time) / DAY_MS));
  return days === 0 ? 'today' : `${days}d ago`;
}

export function feedHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function topicSummary(description: string): string {
  return description.replace(/\s*·\s*_\d{4}-\d{2}-\d{2}_.*$/, '');
}
