import { pageNumberOf, type PageText } from './outline';

/** A bullet's state, from the BuJo keys: • open, ^ in progress, ○ event, x done, > moved, < scheduled. */
export type TaskState =
  'open' | 'progress' | 'event' | 'done' | 'migrated' | 'scheduled';

/** The states still waiting on the writer; the rest are crossed out or handed on. */
export const OPEN_STATES: ReadonlySet<TaskState> = new Set([
  'open',
  'progress',
  'event',
]);

export interface PageTask {
  text: string;
  state: TaskState;
  /** The bullet this one is indented under, when it is a sub-item. */
  parent?: string;
}

// OCR writes a handwritten x as 「人」 or ×, and a bullet as · or ●; an event circle as o or ◯.
const KEYS: readonly [RegExp, TaskState][] = [
  [/^[•·●*]$/, 'open'],
  [/^\^$/, 'progress'],
  [/^[○◯o]$/i, 'event'],
  [/^[xX×✕✗人]$/, 'done'],
  [/^>$/, 'migrated'],
  [/^<$/, 'scheduled'],
];

const BULLET = /^(\s*)(\S)\s+(.+)$/;

function stateOf(key: string): TaskState | undefined {
  return KEYS.find(([re]) => re.test(key))?.[1];
}

/** The bullets of one transcription, in reading order; notes and plain lines are left out. */
export function parseTasks(transcription: string | null): PageTask[] {
  if (!transcription) return [];
  const body = transcription.split(/^TEXT:\s*$/m).pop() ?? '';
  const tasks: PageTask[] = [];
  let parent: string | undefined;
  for (const line of body.split('\n')) {
    const match = BULLET.exec(line);
    const state = match && stateOf(match[2] ?? '');
    if (!match || !state) {
      if (line.trim() && !/^\s/.test(line)) parent = undefined;
      continue;
    }
    const text = (match[3] ?? '').trim();
    const indented = (match[1] ?? '').length > 0;
    tasks.push({ text, state, ...(indented && parent && { parent }) });
    if (!indented) parent = text;
  }
  return tasks;
}

export interface TaskPage extends PageText {
  notebookId: number;
  notebookName: string;
}

export interface TaskSource {
  pageId: number;
  notebookId: number;
  notebookName: string;
  /** The handwritten page number, else the page's place in the notebook. */
  number: number;
  pageDate: string | null;
}

export interface OpenTask extends PageTask {
  /** Where it was last written. */
  source: TaskSource;
  /** Where it was first written, when that is an earlier page. */
  firstSeen?: TaskSource;
  /** Written down longer ago than `STALE_DAYS` and never crossed out. */
  stale: boolean;
}

export const STALE_DAYS = 42;

const sourceOf = (page: TaskPage): TaskSource => ({
  pageId: page.id,
  notebookId: page.notebookId,
  notebookName: page.notebookName,
  number: pageNumberOf(page),
  pageDate: page.pageDate,
});

/** Same item, however it was spaced or punctuated when copied forward. */
const taskKey = (text: string) =>
  text
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .slice(0, 60);

const daysBetween = (from: string, to: Date) =>
  (to.getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000;

/**
 * The items still open across `pages`, which must be in writing order (oldest first). An item
 * copied forward counts once: its latest copy decides whether it is still open, and the earliest
 * names where it was first written.
 */
export function openTasks(
  pages: readonly TaskPage[],
  now = new Date(),
): OpenTask[] {
  const latest = new Map<string, { task: PageTask; page: TaskPage }>();
  const first = new Map<string, TaskPage>();
  for (const page of pages) {
    for (const task of parseTasks(page.transcription)) {
      const key = taskKey(task.text);
      if (!key) continue;
      if (!first.has(key)) first.set(key, page);
      // Re-inserting keeps the map in order of each item's latest copy.
      latest.delete(key);
      latest.set(key, { task, page });
    }
  }
  const open: OpenTask[] = [];
  for (const [key, { task, page }] of latest) {
    if (!OPEN_STATES.has(task.state)) continue;
    // An event is something to attend, so once its day has passed there is nothing left to do.
    if (
      task.state === 'event' &&
      page.pageDate !== null &&
      daysBetween(page.pageDate, now) >= 1
    )
      continue;
    const firstPage = first.get(key) ?? page;
    const since = firstPage.pageDate ?? page.pageDate;
    open.push({
      ...task,
      source: sourceOf(page),
      ...(firstPage.id !== page.id && { firstSeen: sourceOf(firstPage) }),
      stale:
        task.state !== 'event' &&
        since !== null &&
        daysBetween(since, now) > STALE_DAYS,
    });
  }
  return open.reverse();
}
