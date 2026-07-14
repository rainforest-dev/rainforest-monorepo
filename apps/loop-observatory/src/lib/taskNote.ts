import { readFileSync, writeFileSync } from 'node:fs';
import { join, normalize, resolve, sep } from 'node:path';

import { renderMarkdown } from './markdown.js';
import { readTasks, type SprintTask, type TaskScope } from './tasks.js';

/** A task's local note, resolved from the vault and rendered for the drawer. */
export interface TaskNote {
  id: string;
  scope: TaskScope;
  /** Vault-relative path the note was read from. */
  path: string;
  /** Task title (from tasks.json). */
  name: string;
  frontmatter: Record<string, string | number | boolean | string[]>;
  /** Rendered HTML of the note body (frontmatter stripped). */
  html: string;
  /**
   * Editable feedback: the note's `## Notes` section text, scaffold comments
   * stripped. Pre-fills the drawer's Feedback textarea; empty when untouched.
   */
  feedback: string;
  /** Whether `feedback` holds real user content (drives the pending indicator). */
  hasFeedback: boolean;
  /** Secondary link — only for work tasks (their `task_ref` is a Notion URL). */
  notionUrl: string | null;
}

function vaultBase(): string {
  return process.env.VAULT_PATH ?? '/vault';
}

/** Parse a scalar frontmatter value: quoted string, number, boolean, or array. */
function parseScalar(raw: string): string | number | boolean | string[] {
  const v = raw.trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    return v
      .slice(1, -1)
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter((s) => s.length > 0);
  }
  const unquoted = v.replace(/^["']|["']$/g, '');
  if (unquoted === v) {
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return unquoted;
}

/**
 * Split a note into its YAML frontmatter (shallow key: value pairs) and the
 * markdown body. Notes without frontmatter return an empty map + full content.
 */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, string | number | boolean | string[]>;
  body: string;
} {
  const fm: Record<string, string | number | boolean | string[]> = {};
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
  if (!m) return { frontmatter: fm, body: content };

  for (const raw of m[1].split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (kv) fm[kv[1]] = parseScalar(kv[2]);
  }
  return { frontmatter: fm, body: content.slice(m[0].length) };
}

/**
 * Resolve a task's note path from tasks.json (never from client input):
 *   • personal → the vault-relative path in the task's `task_ref`;
 *   • work     → `_system/tasks/<numeric-id>.md`.
 * Returns an absolute path, or `null` when it can't be safely resolved (unknown
 * scope, non-numeric work id, or a path that escapes the vault root).
 */
function resolveNotePath(task: SprintTask): { abs: string; rel: string } | null {
  let rel: string;
  if (task.scope === 'personal') {
    if (!task.task_ref || /^https?:/.test(task.task_ref)) return null;
    rel = task.task_ref;
  } else {
    if (!/^\d+$/.test(String(task.id))) return null;
    rel = join('_system', 'tasks', `${task.id}.md`);
  }

  const baseAbs = resolve(vaultBase());
  const abs = normalize(resolve(baseAbs, rel));
  // Containment guard: the resolved file must stay inside the vault.
  if (abs !== baseAbs && !abs.startsWith(baseAbs + sep)) return null;
  return { abs, rel };
}

/** The task whose id matches `id` (string-compared: numeric + slug ids). */
function findTask(id: string): SprintTask | null {
  const data = readTasks();
  if (!data) return null;
  return data.tasks.find((t) => String(t.id) === id) ?? null;
}

const NOTES_HEADING = /^##\s+Notes\s*$/;

/**
 * The raw text under the `## Notes` heading (heading excluded), up to the next
 * `## ` heading or end of file. `null` when the note has no `## Notes` section.
 */
export function extractNotesSection(body: string): string | null {
  const lines = body.split('\n');
  const start = lines.findIndex((l) => NOTES_HEADING.test(l.trim()));
  if (start === -1) return null;
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

/** The user-facing feedback text: Notes body with scaffold comments stripped. */
function feedbackText(notesRaw: string | null): string {
  if (notesRaw === null) return '';
  return notesRaw.replace(/<!--[\s\S]*?-->/g, '').trim();
}

/**
 * Replace the body under a note's `## Notes` heading with `feedback`, preserving
 * everything else verbatim — frontmatter, the `# title`, the
 * `<!-- sync:managed -->` line, and any section after Notes. When the note has
 * no `## Notes` heading, one is appended.
 */
export function replaceNotesSection(content: string, feedback: string): string {
  const clean = feedback.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  const lines = content.split('\n');
  const start = lines.findIndex((l) => NOTES_HEADING.test(l.trim()));

  if (start === -1) {
    const base = content.replace(/\s+$/, '');
    const bodyPart = clean ? `${clean}\n` : '';
    return `${base}\n\n## Notes\n\n${bodyPart}`;
  }

  // End of the Notes section = next `## ` heading (kept), else end of file.
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }

  const head = lines.slice(0, start + 1).join('\n'); // …up to and incl. "## Notes"
  const tail = lines.slice(end).join('\n'); // next section onward (may be empty)
  const bodyPart = clean ? `${clean}\n` : '';
  let out = `${head}\n\n${bodyPart}`;
  if (tail.trim() !== '') out += `\n${tail}`;
  return out;
}

function buildNote(
  id: string,
  task: SprintTask,
  rel: string,
  content: string,
): TaskNote {
  const { frontmatter, body } = parseFrontmatter(content);
  const feedback = feedbackText(extractNotesSection(body));
  const notionUrl =
    task.scope === 'work' && task.task_ref && /^https?:/.test(task.task_ref)
      ? task.task_ref
      : null;
  return {
    id,
    scope: task.scope,
    path: rel,
    name: task.name,
    frontmatter,
    html: renderMarkdown(body),
    feedback,
    hasFeedback: feedback.length > 0,
    notionUrl,
  };
}

/**
 * Read the local note for the task whose id matches `id` (string-compared, so
 * both numeric and slug ids work). Returns `null` when the task is unknown, the
 * path can't be resolved, or the file is missing.
 */
export function readTaskNote(id: string): TaskNote | null {
  const task = findTask(id);
  if (!task) return null;
  const resolved = resolveNotePath(task);
  if (!resolved) return null;

  let content: string;
  try {
    content = readFileSync(resolved.abs, 'utf-8');
  } catch {
    return null;
  }
  return buildNote(id, task, resolved.rel, content);
}

/** Cheap check: does this task's note carry real user feedback under `## Notes`? */
export function noteHasFeedback(task: SprintTask): boolean {
  const resolved = resolveNotePath(task);
  if (!resolved) return false;
  let content: string;
  try {
    content = readFileSync(resolved.abs, 'utf-8');
  } catch {
    return false;
  }
  const { body } = parseFrontmatter(content);
  return feedbackText(extractNotesSection(body)).length > 0;
}

/**
 * Write `feedback` into the task's note under `## Notes`, preserving the rest of
 * the file. Returns the freshly re-read note, or `null` when unresolvable/absent.
 */
export function writeTaskFeedback(id: string, feedback: string): TaskNote | null {
  const task = findTask(id);
  if (!task) return null;
  const resolved = resolveNotePath(task);
  if (!resolved) return null;

  let content: string;
  try {
    content = readFileSync(resolved.abs, 'utf-8');
  } catch {
    return null;
  }

  const next = replaceNotesSection(content, feedback);
  writeFileSync(resolved.abs, next, 'utf-8');
  return buildNote(id, task, resolved.rel, next);
}
