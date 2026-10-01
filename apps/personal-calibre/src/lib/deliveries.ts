import type { BookDeliveryEvent } from '@/types';

const pad = (n: number) => String(n).padStart(2, '0');

function parseStoredTime(value: string): Date {
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
  return new Date(iso);
}

export function formatDeliveryTime(value: string): string {
  const d = parseStoredTime(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDeliveryDate(value: string): string {
  const time = formatDeliveryTime(value);
  return time === value ? value : time.slice(0, 10);
}

export function latestByPlatform(
  events: readonly BookDeliveryEvent[],
): Map<string, BookDeliveryEvent> {
  const latest = new Map<string, BookDeliveryEvent>();
  for (const event of events) {
    if (!latest.has(event.platformKey)) latest.set(event.platformKey, event);
  }
  return latest;
}
