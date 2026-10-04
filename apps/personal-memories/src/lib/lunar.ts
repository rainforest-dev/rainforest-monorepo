const LUNAR = new Intl.DateTimeFormat('en-u-ca-chinese', {
  timeZone: 'UTC',
  month: 'numeric',
  day: 'numeric',
});

const FESTIVALS: Record<string, string> = {
  '1-1': '春節',
  '1-15': '元宵',
  '5-5': '端午',
  '7-7': '七夕',
  '8-15': '中秋',
};

export const isLunarFestival = (name: string) =>
  name === '除夕' || Object.values(FESTIVALS).includes(name);

const DAY_MS = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const cache = new Map<number, Record<string, string>>();

export function lunarHolidays(year: number): Record<string, string> {
  const hit = cache.get(year);
  if (hit) return hit;
  const found: Record<string, string> = {};
  for (
    let t = Date.UTC(year, 0, 1);
    t < Date.UTC(year + 1, 0, 1);
    t += DAY_MS
  ) {
    const parts = LUNAR.formatToParts(t);
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    const day = parts.find((p) => p.type === 'day')?.value;
    // A leap month formats as "4bis" (ICU), so a numeric-only check skips it.
    if (!/^\d+$/.test(month)) continue;
    const name = FESTIVALS[`${month}-${day}`];
    if (name && !found[name]) found[name] = iso(t);
  }
  if (found['春節']) found['除夕'] = iso(Date.parse(found['春節']) - DAY_MS);
  cache.set(year, found);
  return found;
}
