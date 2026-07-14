import { readFileSync } from 'node:fs';
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

/**
 * Read the local note for the task whose id matches `id` (string-compared, so
 * both numeric and slug ids work). Returns `null` when the task is unknown, the
 * path can't be resolved, or the file is missing.
 */
export function readTaskNote(id: string): TaskNote | null {
  const data = readTasks();
  if (!data) return null;

  const task = data.tasks.find((t) => String(t.id) === id);
  if (!task) return null;

  const resolved = resolveNotePath(task);
  if (!resolved) return null;

  let content: string;
  try {
    content = readFileSync(resolved.abs, 'utf-8');
  } catch {
    return null;
  }

  const { frontmatter, body } = parseFrontmatter(content);
  const notionUrl =
    task.scope === 'work' && task.task_ref && /^https?:/.test(task.task_ref)
      ? task.task_ref
      : null;

  return {
    id,
    scope: task.scope,
    path: resolved.rel,
    name: task.name,
    frontmatter,
    html: renderMarkdown(body),
    notionUrl,
  };
}
