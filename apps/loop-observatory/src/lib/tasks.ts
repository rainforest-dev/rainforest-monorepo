import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { usageDir } from './ledger.js';
import { DEFAULT_STATUSES } from './taskStatus.js';

/** A linked Notion record (epic or parent story) referenced by a task. */
export interface TaskLink {
  id: number | null;
  name: string;
  url: string | null;
}

/** Where a task originates: `work` (Notion board) or `personal` (Obsidian). */
export type TaskScope = 'work' | 'personal';

/** One sprint work item as it appears in `tasks.json`'s `tasks` array. */
export interface SprintTask {
  /** Numeric for Notion work tasks; a slug string for personal (Obsidian) ones. */
  id: number | string | null;
  /** Board sort order; drives card/node ordering. */
  order: number;
  name: string;
  /** Deep link to the Notion page; the whole card/node links here. */
  task_ref: string | null;
  task_source: string;
  /** Origin of the task; defaults to `work` for older snapshots. */
  scope: TaskScope;
  status: string;
  work_type: string | null;
  /** "P0".."P3" or `null`. */
  priority: string | null;
  /** Story points; `null` when unpointed. */
  points: number | null;
  /** Component tag (e.g. "cloud-backend"); `null` when unset. */
  component: string | null;
  platform: string[];
  epic: TaskLink | null;
  parent: TaskLink | null;
  /**
   * Whether the task's local note has real user feedback under `## Notes`.
   * Not read from `tasks.json` — the tasks API augments each task with this so
   * the board/graph can flag notes awaiting tuning.
   */
  hasFeedback?: boolean;
}

/** The active sprint the board is scoped to. */
export interface Sprint {
  id: number | null;
  name: string;
  status: string | null;
  start: string | null;
  url: string | null;
}

/** Parsed shape of `_system/usage/tasks.json`. */
export interface TasksData {
  synced_at: string | null;
  source: string | null;
  board: string | null;
  board_url: string | null;
  sprint: Sprint | null;
  assignee: string | null;
  /** Status columns in board order. */
  statuses: string[];
  tasks: SprintTask[];
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Task id: numeric (Notion) or a non-empty slug string (personal). */
function numOrStr(v: unknown): number | string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.length > 0) return v;
  return null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

/** Task origin; anything but `personal` (incl. missing) is treated as `work`. */
function parseScope(v: unknown): TaskScope {
  return v === 'personal' ? 'personal' : 'work';
}

/** Parse an epic/parent reference; `null` when absent or not an object. */
function parseLink(v: unknown): TaskLink | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const name = strOrNull(o.name);
  if (!name) return null;
  return { id: num(o.id), name, url: strOrNull(o.url) };
}

/** Parse one task object; `null` when it is not a usable object. */
function parseTask(v: unknown): SprintTask | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const name = strOrNull(o.name);
  if (!name) return null;
  return {
    id: numOrStr(o.id),
    order: num(o.order) ?? 0,
    name,
    task_ref: strOrNull(o.task_ref),
    task_source: str(o.task_source),
    scope: parseScope(o.scope),
    status: strOrNull(o.status) ?? 'Backlog',
    work_type: strOrNull(o.work_type),
    priority: strOrNull(o.priority),
    points: num(o.points),
    component: strOrNull(o.component),
    platform: strArray(o.platform),
    epic: parseLink(o.epic),
    parent: parseLink(o.parent),
  };
}

function parseSprint(v: unknown): Sprint | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const name = strOrNull(o.name);
  if (!name) return null;
  return {
    id: num(o.id),
    name,
    status: strOrNull(o.status),
    start: strOrNull(o.start),
    url: strOrNull(o.url),
  };
}

/**
 * Parse the raw `tasks.json` content. Returns `null` when the content is not a
 * JSON object (so a missing/garbled file degrades to an empty view rather than
 * crashing). A malformed individual task is skipped; a missing `statuses` list
 * falls back to the canonical order.
 */
export function parseTasks(content: string): TasksData | null {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return null;
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;

  const statuses = strArray(o.statuses);
  const rawTasks = Array.isArray(o.tasks) ? o.tasks : [];
  const tasks = rawTasks
    .map(parseTask)
    .filter((t): t is SprintTask => t !== null)
    .sort((a, b) => a.order - b.order);

  return {
    synced_at: strOrNull(o.synced_at),
    source: strOrNull(o.source),
    board: strOrNull(o.board),
    board_url: strOrNull(o.board_url),
    sprint: parseSprint(o.sprint),
    assignee: strOrNull(o.assignee),
    statuses: statuses.length ? statuses : [...DEFAULT_STATUSES],
    tasks,
  };
}

/** Absolute path of the sprint task snapshot. */
export function tasksPath(): string {
  return join(usageDir(), 'tasks.json');
}

/**
 * Read and parse `_system/usage/tasks.json`. Returns `null` when the file is
 * absent, unreadable, or not a JSON object — the view renders an empty state.
 */
export function readTasks(): TasksData | null {
  let content: string;
  try {
    content = readFileSync(tasksPath(), 'utf-8');
  } catch {
    return null; // no snapshot yet → empty state
  }
  return parseTasks(content);
}
