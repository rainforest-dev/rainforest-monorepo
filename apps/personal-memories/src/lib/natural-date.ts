import { isLunarFestival, lunarHolidays } from './lunar.ts';

export type DateRange = { start: string; end: string };

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);
const shift = (date: string, days: number) => iso(utc(date) + days * DAY_MS);
const single = (date: string): DateRange => ({ start: date, end: date });

export const localISODate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function ymd(year: number, month: number, day: number): string | undefined {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCMonth() === month - 1 && d.getUTCDate() === day
    ? iso(d.getTime())
    : undefined;
}

function monthRange(year: number, month: number): DateRange {
  return {
    start: iso(Date.UTC(year, month - 1, 1)),
    end: iso(Date.UTC(year, month, 0)),
  };
}

const yearRange = (year: number): DateRange => ({
  start: `${year}-01-01`,
  end: `${year}-12-31`,
});

const RELATIVE_DAYS: Record<string, number> = {
  今天: 0,
  今日: 0,
  昨天: -1,
  昨日: -1,
  前天: -2,
  大前天: -3,
};

const RELATIVE_YEARS: Record<string, number> = { 今年: 0, 去年: -1, 前年: -2 };

const WEEK_OFFSETS: Record<string, number> = {
  這: 0,
  本: 0,
  上: -1,
  上上: -2,
};

const WEEKDAYS = '日一二三四五六';

const SOLAR_FESTIVALS: Record<string, [number, number]> = {
  元旦: [1, 1],
  情人節: [2, 14],
  平安夜: [12, 24],
  聖誕節: [12, 25],
  耶誕節: [12, 25],
  跨年: [12, 31],
};

const FESTIVAL_ALIASES: Record<string, string> = {
  過年: '春節',
  大年初一: '春節',
  元宵節: '元宵',
  端午節: '端午',
  中秋節: '中秋',
};

const YEAR = String.raw`(?:(\d{4})年?|(今年|去年|前年))?`;
const WEEKDAY_RE = /^(上上|上|這|本)?(?:週|星期|禮拜)([一二三四五六日天])$/;
const WEEK_RE = /^(上上|上|這|本)週$/;
const MONTH_DAY_RE = new RegExp(
  String.raw`^${YEAR}(\d{1,2})月(?:(\d{1,2})日?)?$`,
);
const SLASH_RE = /^(\d{1,2})[/.-](\d{1,2})$/;
const FESTIVAL_RE = new RegExp(`^${YEAR}(\\D+)$`);

function normalise(raw: string): string {
  return raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, '')
    .replace(/周/g, '週')
    .replace(/[號号]/g, '日')
    .replace(/(這|本|上)個?(週|月)/g, '$1$2');
}

function explicitYear(
  digits: string | undefined,
  word: string | undefined,
  todayYear: number,
): number | undefined {
  if (digits) return Number(digits);
  if (word) return todayYear + (RELATIVE_YEARS[word] ?? 0);
  return undefined;
}

function latest(
  today: string,
  year: number | undefined,
  dateIn: (year: number) => string | undefined,
): string | undefined {
  if (year !== undefined) return dateIn(year);
  const todayYear = Number(today.slice(0, 4));
  for (let y = todayYear; y > todayYear - 8; y--) {
    const date = dateIn(y);
    if (date && date <= today) return date;
  }
  return undefined;
}

export function parseDateQuery(
  raw: string,
  today: string,
): DateRange | undefined {
  const q = normalise(raw);
  if (!q) return undefined;
  const todayYear = Number(today.slice(0, 4));
  const todayMonth = Number(today.slice(5, 7));

  const dayOffset = RELATIVE_DAYS[q];
  if (dayOffset !== undefined) return single(shift(today, dayOffset));

  const yearOffset = RELATIVE_YEARS[q];
  if (yearOffset !== undefined) return yearRange(todayYear + yearOffset);

  if (q === '這月' || q === '本月') return monthRange(todayYear, todayMonth);
  if (q === '上月')
    return todayMonth === 1
      ? monthRange(todayYear - 1, 12)
      : monthRange(todayYear, todayMonth - 1);

  const monday = shift(today, -((new Date(utc(today)).getUTCDay() + 6) % 7));

  const week = WEEK_RE.exec(q);
  if (week) {
    const start = shift(monday, 7 * (WEEK_OFFSETS[week[1] ?? ''] ?? 0));
    return { start, end: shift(start, 6) };
  }

  const weekday = WEEKDAY_RE.exec(q);
  if (weekday) {
    const dow = WEEKDAYS.indexOf(
      weekday[2] === '天' ? '日' : (weekday[2] ?? ''),
    );
    const sinceMonday = (dow + 6) % 7;
    if (weekday[1])
      return single(
        shift(monday, 7 * (WEEK_OFFSETS[weekday[1]] ?? 0) + sinceMonday),
      );
    const back = (new Date(utc(today)).getUTCDay() - dow + 7) % 7;
    return single(shift(today, -back));
  }

  const monthDay = MONTH_DAY_RE.exec(q);
  if (monthDay) {
    const [, digits, word, m, d] = monthDay;
    const month = Number(m);
    if (month < 1 || month > 12) return undefined;
    const year = explicitYear(digits, word, todayYear);
    if (d === undefined) {
      const y = year ?? (month <= todayMonth ? todayYear : todayYear - 1);
      return monthRange(y, month);
    }
    const date = latest(today, year, (y) => ymd(y, month, Number(d)));
    return date ? single(date) : undefined;
  }

  const slash = SLASH_RE.exec(q);
  if (slash) {
    const date = latest(today, undefined, (y) =>
      ymd(y, Number(slash[1]), Number(slash[2])),
    );
    return date ? single(date) : undefined;
  }

  const festival = FESTIVAL_RE.exec(q);
  if (festival) {
    const [, digits, word, name = ''] = festival;
    const key = FESTIVAL_ALIASES[name] ?? name;
    const solar = SOLAR_FESTIVALS[key];
    if (!solar && !isLunarFestival(key)) return undefined;
    const dateIn = solar
      ? (y: number) => ymd(y, solar[0], solar[1])
      : (y: number) => lunarHolidays(y)[key];
    const date = latest(today, explicitYear(digits, word, todayYear), dateIn);
    return date ? single(date) : undefined;
  }

  return undefined;
}
