export type DayBox = { date: string; top: number };

const LINE = 0.4;

export function activeDayAt(
  days: readonly DayBox[],
  viewportHeight: number,
  remaining: number,
): string | undefined {
  const runway = viewportHeight * (1 - LINE);
  const progress = Math.min(1, Math.max(0, 1 - remaining / runway));
  const line = viewportHeight * LINE + runway * progress;
  let current = days[0];
  for (const day of days) {
    if (day.top > line) break;
    current = day;
  }
  return current?.date;
}
