import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ExecutionPlan } from './taskPlan.js';
import type { SprintTask } from './tasks.js';

export const OUTBOX_VERSION = 1;

/** Ids safe to use as a path segment and to write into Air's allowlist. */
export const SAFE_ID = /^[A-Za-z]{0,8}-?\d{1,9}$/;

/** Acked pairs older than this are pruned on the next write. */
const PRUNE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export type OutboxResult = 'applied' | 'duplicate' | 'failed';
export type OutboxState = 'none' | 'pending' | OutboxResult;

export interface OutboxRequest {
  version: number;
  id: string;
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

export function requestState(slug: string, id: string): OutboxState {
  if (!readRequest(slug, id)) return 'none';
  // Distinguish "no ack file yet" (pending) from "ack file exists but is
  // corrupt/unparseable" (failed) -- an absent and an unreadable ack must
  // never be conflated, or a write that silently failed could read as if
  // Air simply had not answered yet.
  if (!existsSync(ackPath(slug, id))) return 'pending';
  const ack = readAck(slug, id);
  if (!ack) return 'failed';
  if (ack.version !== OUTBOX_VERSION) return 'failed';
  if (ack.result === 'applied' || ack.result === 'duplicate') return ack.result;
  return 'failed';
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
    if (!ack || ack.result === 'failed') continue;
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
    slug,
    name: oneLine(task.name),
    comment: oneLine(comment),
    plan,
    requestedAt: now.toISOString(),
    requestedBy: process.env.USAGE_MACHINE ?? 'rainforest-mini',
  };

  mkdirSync(slugDir(slug), { recursive: true });
  writeFileSync(requestPath(slug, id), `${JSON.stringify(request, null, 2)}\n`, 'utf-8');
  prunePairs(slug, now);
  return request;
}
