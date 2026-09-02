/**
 * The Tasks board's heading strings.
 *
 * Pure and `now`-injected so the ages are testable: TasksPanel is a
 * client-hydrated island, so this stays free of Vue and of `node:*` imports
 * (same rule as taskSort.ts).
 */

import { formatDistanceStrict } from 'date-fns';

/**
 * The half of the sentence the design fixes verbatim. It is the point of the
 * pill: the board is a tracker, so a card can be stale without anything here
 * being broken.
 */
export const TRACKER_CAVEAT = 'tracker, not live: cards may already have moved';

function ageOf(iso: string | null | undefined, now: Date): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return formatDistanceStrict(new Date(t), now, { addSuffix: true });
}

/**
 * Both ages, each naming the half it describes, then the caveat.
 *
 * This was one label reading `synced <age>` off `synced_at`, which only moves
 * when the work half is fetched from Notion. A local run rebuilds the personal
 * half and leaves that field alone -- correctly -- so on 2026-09-02 the panel
 * said "synced 14 days ago" over a personal list refreshed a minute earlier.
 * The design canvas shows a single `synced N days ago`; the board's own data
 * does not support one number, so the two readings are kept and the canvas's
 * sentence is appended to them.
 *
 * Returns the caveat alone when neither timestamp is readable -- an unknown
 * age is no reason to stop saying the board is a tracker.
 */
export function trackerNotice(
  syncedAt: string | null | undefined,
  writtenAt: string | null | undefined,
  now: Date,
): string {
  const work = ageOf(syncedAt, now);
  const written = ageOf(writtenAt, now);
  const ages =
    work && written
      ? `work synced ${work} · rebuilt ${written}`
      : work
        ? `work synced ${work}`
        : written
          ? `rebuilt ${written}`
          : null;
  return ages ? `${ages} — ${TRACKER_CAVEAT}` : TRACKER_CAVEAT;
}

/** `Sprint tasks · Sprint 3`, or just the prefix when no sprint is loaded. */
export function sprintHeading(sprintName: string | null | undefined): {
  title: string;
  suffix: string | null;
} {
  return {
    title: 'Sprint tasks',
    suffix: sprintName ? `· ${sprintName}` : null,
  };
}
