import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ExecutionPlan } from './taskPlan.js';
import type { SprintTask } from './tasks.js';

export const OUTBOX_VERSION = 1;

/**
 * Ids safe to use as a path segment and to write into Air's allowlist.
 *
 * Mirrored by SAFE_ID in Air's loopctl/greenlight.py, which is the trust
 * boundary and must never be the looser of the two. Note that Python's `$`
 * also matches before a trailing newline where JavaScript's does not, so that
 * side spells the anchors `\A`/`\Z`.
 *
 * The digit run is up to 20 because a personal task id is a timestamp —
 * `T-20260720151941`, fourteen digits — and the old `\d{1,9}` could not
 * represent one at all.
 */
export const SAFE_ID = /^[A-Za-z]{0,8}-?\d{1,20}$/;

/** Acked pairs older than this are pruned on the next write. */
const PRUNE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The verdicts that can appear in an ack file.
 *
 * `loopctl greenlight-apply` also emits `busy` when a sweep holds the project
 * lock, but that one is retryable and pull.sh deliberately writes no ack for
 * it, so it can never reach this type. Anything not listed here — including a
 * `busy` that somehow did land in a file — collapses to 'failed' via
 * `isFailedAck` rather than crashing. Keep this in step with the verdict enum
 * in pull.sh.
 */
export type OutboxResult = 'applied' | 'duplicate' | 'failed';
export type OutboxState = 'none' | 'pending' | OutboxResult;

export interface OutboxRequest {
  version: number;
  id: string;
  /**
   * The id as the board spelled it. Now always equal to `id` — it existed to
   * carry the `AG-` prefix that canonicalisation stripped off `id`, and there
   * is no longer any stripping. Kept because Air prints it on the allowlist
   * continuation line the owner reads, and requests written before it existed
   * are still on disk; Air falls back to `id` when it is absent.
   */
  sourceId?: string;
  slug: string;
  name: string;
  comment: string;
  plan: ExecutionPlan | null;
  requestedAt: string;
  requestedBy: string;
}

export interface OutboxAck {
  version: number;
  id: string;
  result: OutboxResult;
  reason: string | null;
  appliedAt: string;
  machine: string;
}

export function outboxDir(): string {
  return (
    process.env.LOOP_GREENLIGHT_OUTBOX_DIR ??
    join(process.env.HOME ?? '', '.claude', 'loop', 'greenlight-outbox')
  );
}

function slugDir(slug: string): string {
  return join(outboxDir(), slug);
}

function requestPath(slug: string, id: string): string {
  return join(slugDir(slug), `${id}.json`);
}

function ackPath(slug: string, id: string): string {
  return join(slugDir(slug), `${id}.ack.json`);
}

/** Collapse CR/LF so a request can never forge an extra allowlist line. */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

export function readRequest(slug: string, id: string): OutboxRequest | null {
  if (!SAFE_ID.test(id)) return null;
  return readJson<OutboxRequest>(requestPath(slug, id));
}

export function readAck(slug: string, id: string): OutboxAck | null {
  if (!SAFE_ID.test(id)) return null;
  return readJson<OutboxAck>(ackPath(slug, id));
}

/**
 * True when a parsed ack does not count as an answer: missing, a protocol
 * version we do not recognise, or a result we do not recognise. Shared by
 * requestState and prunePairs so what counts as failed cannot drift between
 * the two -- an ack that requestState reports as failed must be exactly the
 * set of acks prunePairs refuses to delete.
 */
function isFailedAck(ack: OutboxAck | null): boolean {
  return !ack || ack.version !== OUTBOX_VERSION || (ack.result !== 'applied' && ack.result !== 'duplicate');
}

export function requestState(slug: string, id: string): OutboxState {
  if (!readRequest(slug, id)) return 'none';
  // Distinguish "no ack file yet" (pending) from "ack file exists but is
  // corrupt/unparseable" (failed) -- an absent and an unreadable ack must
  // never be conflated, or a write that silently failed could read as if
  // Air simply had not answered yet.
  if (!existsSync(ackPath(slug, id))) return 'pending';
  const ack = readAck(slug, id);
  if (!ack || isFailedAck(ack)) return 'failed';
  return ack.result;
}

/**
 * Every request's state for one slug, from a single directory read.
 *
 * The board needs this for every card at once, so per-task `requestState` calls
 * would mean two fs checks per card. A pending request needs no file read at
 * all here — the absence of its ack in the same listing is the answer.
 */
export function scanStates(slug: string): Record<string, OutboxState> {
  const dir = slugDir(slug);
  if (!existsSync(dir)) return {};
  const entries = new Set(readdirSync(dir));
  const states: Record<string, OutboxState> = {};
  for (const entry of entries) {
    if (!entry.endsWith('.json') || entry.endsWith('.ack.json')) continue;
    const id = entry.slice(0, -'.json'.length);
    if (!SAFE_ID.test(id)) continue;
    // The filename is the id, verbatim: callers look these up by the same
    // board id writeRequest filed them under.
    states[id] = entries.has(`${id}.ack.json`) ? requestState(slug, id) : 'pending';
  }
  return states;
}

/**
 * Outbox state for every task, scanning each slug once.
 *
 * `scan` is injectable so a test can assert the call count: the board renders
 * ~37 cards and a per-card scan would mean two filesystem checks each, so
 * "once per slug" is a requirement, not an optimisation.
 */
export function statesForSlugs(
  slugs: Iterable<string>,
  scan: (slug: string) => Record<string, OutboxState> = scanStates,
): Map<string, Record<string, OutboxState>> {
  return new Map([...new Set(slugs)].map((slug) => [slug, scan(slug)]));
}

/**
 * Drop acked pairs past the retention window; return the ids removed.
 *
 * Two kinds of pair are deliberately immortal: an unacked request is still
 * owed an answer, and a `failed` pair is a failure that must not vanish
 * unnoticed. Exported so the retention rule can be tested directly.
 */
export function prunePairs(slug: string, now: Date = new Date()): string[] {
  const dir = slugDir(slug);
  if (!existsSync(dir)) return [];
  const removed: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.json') || entry.endsWith('.ack.json')) continue;
    const id = entry.slice(0, -'.json'.length);
    const request = readRequest(slug, id);
    if (!request) continue;
    const age = now.getTime() - Date.parse(request.requestedAt);
    if (!Number.isFinite(age) || age < PRUNE_AFTER_MS) continue;
    const ack = readAck(slug, id);
    if (isFailedAck(ack)) continue;
    rmSync(requestPath(slug, id), { force: true });
    rmSync(ackPath(slug, id), { force: true });
    removed.push(id);
  }
  return removed;
}

export function writeRequest(
  task: SprintTask,
  slug: string,
  plan: ExecutionPlan | null,
  comment: string,
  now: Date = new Date(),
): OutboxRequest {
  const id = String(task.id);
  if (!SAFE_ID.test(id)) throw new Error(`unsafe task id: ${id}`);

  const request: OutboxRequest = {
    version: OUTBOX_VERSION,
    id,
    sourceId: id,
    slug,
    name: oneLine(task.name),
    comment: oneLine(comment),
    plan,
    requestedAt: now.toISOString(),
    requestedBy: process.env.USAGE_MACHINE ?? 'rainforest-mini',
  };

  mkdirSync(slugDir(slug), { recursive: true });
  writeFileSync(requestPath(slug, id), `${JSON.stringify(request, null, 2)}\n`, 'utf-8');
  // Drop any ack left over from a previous attempt. The pull job's only
  // outstanding-signal is "no ack beside the request", so a stale ack makes a
  // fresh request invisible to it forever -- and prunePairs deliberately never
  // deletes a failed pair, so nothing else would ever clear it. Without this,
  // re-pressing Greenlight after a failure is a no-op against the old verdict
  // rather than a genuine re-request.
  rmSync(ackPath(slug, id), { force: true });
  prunePairs(slug, now);
  return request;
}
