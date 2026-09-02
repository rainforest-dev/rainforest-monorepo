/**
 * How old each answer on the Loop status panel is, in the units a reader
 * decides with.
 *
 * #338 taught this panel to tell "the source is gone" from "the source says
 * nothing". This is the other half of the same lesson. Having established that
 * an absent source and an empty one are different, the panel then printed
 * `Nothing running as of 2026-08-26` and left the reader to work out that
 * 2026-08-26 was seven weeks ago -- so a dead subsystem and a quiet one still
 * rendered as the same sentence unless you checked today's date against it.
 *
 * A date is a fact about the file. An age is the fact the reader wants. Both
 * are shown here, but the age leads.
 *
 * Two ages are kept apart on purpose, because collapsing them is the failure
 * this panel exists to avoid: `read` is how recently the server looked at the
 * file, `age` is how old the newest thing inside it is. A file read four
 * seconds ago can hold forty-seven-day-old content, and only the second number
 * says whether the loop is running.
 *
 * Deliberately free of `node:` imports: `LoopPanel.vue` renders inside a
 * client-hydrated island, so anything it imports for a runtime value ends up in
 * the browser bundle. `SourceStatus` is a type-only import and is erased;
 * `humanAge` comes from `enroll/drift.ts`, whose only import is type-only.
 */
import { humanAge } from './enroll/drift.js';
import type { SourceStatus } from './loop.js';

/** The provenance line one section of the panel shows beneath its heading. */
export interface SourceMeta {
  /** Short name of the file, e.g. `loop-runs.<machine>.jsonl`. */
  label: string;
  /** Full path, for the reader who wants to go and look. */
  path: string;
  /** `read 2 min ago` -- how recently the server opened it. */
  read: string;
  /** `newest entry 47 days old` -- how old what it found is. */
  age: string;
}

/**
 * Epoch ms for a timestamp written by the loop, or null if it carries none.
 *
 * Falls back to the date prefix because a handoff's timestamp is a *filename*:
 * `:` is not safe in one on every filesystem, so the runner may write
 * `2026-09-02T12-53-08Z`, which `Date.parse` rejects outright. The day is still
 * a real date and still worth an age, just a coarser one.
 */
export function epochOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const exact = Date.parse(iso);
  if (!Number.isNaN(exact)) return exact;
  const day = Date.parse(iso.slice(0, 10));
  return Number.isNaN(day) ? null : day;
}

/** How old the newest thing in a source is, said as a duration. */
export function contentAge(src: SourceStatus, nowMs: number): string {
  if (!src.present) return 'not present';
  if (src.newestEntryAt === null) return 'no dated entry to age';
  return `newest entry ${humanAge(nowMs - src.newestEntryAt)} old`;
}

/** Where this section's answer came from, and how old that answer is. */
export function sourceMeta(src: SourceStatus, nowMs: number): SourceMeta {
  return {
    label: src.label,
    path: src.path,
    read: `${src.present ? 'read' : 'looked'} ${humanAge(nowMs - src.readAt)} ago`,
    age: contentAge(src, nowMs),
  };
}

/**
 * What an empty section actually means.
 *
 * "No task currently claimed." reads as a statement about now. On 2026-09-02 it
 * was a statement about 2026-07-13: all three files this panel then read
 * belonged to the retired `vault` source adapter, and nothing had written them
 * since. The age is what makes that visible without arithmetic; the date stays
 * beside it for anyone cross-checking the file itself.
 */
export function emptyReason(
  src: SourceStatus,
  nothing: string,
  nowMs: number,
): string {
  if (!src.present) return `source not present — ${src.path}`;
  if (src.newestEntryAt === null)
    return `${nothing} — source has no dated entry`;
  return `${nothing} — newest entry is ${humanAge(nowMs - src.newestEntryAt)} old (${src.newestEntry})`;
}
