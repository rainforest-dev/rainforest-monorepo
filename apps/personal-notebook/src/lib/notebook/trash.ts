/** How long a notebook stays in Trash before its pages and images are deleted. */
export const TRASH_DAYS = 30;

const DAY_MS = 86_400_000;

/** Reads SQLite's `CURRENT_TIMESTAMP` (UTC, `YYYY-MM-DD HH:MM:SS`) as epoch milliseconds. */
const sqliteTime = (value: string) => Date.parse(`${value.replace(' ', 'T')}Z`);

/** Whole days left before a notebook put in Trash at `trashedAt` is purged; never below 0. */
export function daysLeftInTrash(trashedAt: string, now = Date.now()): number {
  const elapsed = Math.floor((now - sqliteTime(trashedAt)) / DAY_MS);
  return Math.max(0, TRASH_DAYS - elapsed);
}

/** The `trashedAt` value at or before which a notebook is due for purging at `now`. */
export function trashCutoff(now: Date): string {
  return new Date(now.getTime() - TRASH_DAYS * DAY_MS)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
}
