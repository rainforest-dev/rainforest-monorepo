import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { APIRoute } from 'astro';

import { readMachineBudgets } from '../../lib/budget.js';
import {
  cardMeta,
  cardState,
  cautionFor,
  type DecideCard,
  type DecideHost,
  type DecideView,
  greenlightLabel,
  hostState,
  type QuotaAccount,
  quotaAccount,
  type RunningRun,
  stateNote,
  writeLine,
} from '../../lib/decide.js';
import { readDeclarations } from '../../lib/enroll/declarations.js';
import { readHosts } from '../../lib/enroll/store.js';
import { readTelemetry } from '../../lib/enroll/telemetry.js';
import { buildHostViews, type HostView } from '../../lib/enroll/view.js';
import { usageDir } from '../../lib/ledger.js';
import { openRuns, readRuns } from '../../lib/loopVault.js';
import { remainingStatus } from '../../lib/machineReadings.js';
import {
  getTaskDecision,
  GREENLIGHT_TARGETS,
  greenlightDir,
  greenlightPath,
  greenlitCount,
  lineFor,
  REMOTE_EXECUTORS,
} from '../../lib/taskDecision.js';
import { readTasks, type SprintTask } from '../../lib/tasks.js';

/**
 * Board states that are not waiting on anything.
 *
 * Narrower than `TERMINAL_OR_ACTIVE` in `taskDecision.ts` on purpose: that set
 * decides whether a task is a good *candidate*, and it includes "in progress",
 * which is exactly the kind of card the canvas keeps on screen. This set is
 * only about whether a decision is still owed at all.
 */
const FINISHED = new Set(['done', 'merged', 'released', 'closed']);

/** This host, named the way the vault names it. Never a hardcoded machine. */
function thisMachine(): string {
  return process.env.USAGE_MACHINE ?? 'rainforest-mini';
}

function finished(task: SprintTask): boolean {
  return FINISHED.has(
    String(task.loopStatus ?? task.status)
      .trim()
      .toLowerCase(),
  );
}

/** Newest of a host's two readings; `null` when it has produced neither. */
function newestAge(view: HostView | undefined): number | null {
  const ages = [
    view?.readings.telemetry?.ageMs,
    view?.readings.enrollment?.ageMs,
  ].filter((ms): ms is number => typeof ms === 'number');
  return ages.length ? Math.min(...ages) : null;
}

function ageWords(ms: number): string {
  const secs = Math.round(ms / 1000);
  if (secs < 90) return `${secs} s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 90) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** What a host is declared to run, or the fact that nothing declares it. */
function scopeWords(view: HostView | undefined, declared: string | null) {
  if (declared === 'work') return 'company work only';
  if (declared === 'personal') return 'personal work only';
  return view ? 'scope not declared' : 'never enrolled';
}

export const GET: APIRoute = () => {
  try {
    const now = Date.now();

    // --- hosts, from the same two readers Setup and Overview use ------------
    const records = readHosts();
    const declarations = readDeclarations();
    const telemetry = readTelemetry([
      ...Object.keys(records),
      ...Object.keys(declarations?.byHost ?? {}),
    ]);
    const views = buildHostViews(records, now, declarations, telemetry);
    const budgets = readMachineBudgets(now);

    const hostNames = [
      ...new Set([...Object.keys(views), ...Object.keys(budgets)]),
    ].sort();

    const hosts: DecideHost[] = hostNames.map((name) => {
      const view = views[name];
      const age = newestAge(view);
      const state = hostState(age);
      const declared = declarations?.byHost?.[name]?.scope ?? null;
      return {
        name,
        state,
        scope: scopeWords(view, declared),
        report: age === null ? 'never reported' : ageWords(age),
        reportStatus: state === 'ok' ? 'ok' : 'warn',
        greenlight: greenlightLabel(
          name === thisMachine() ? localGreenlitTotal() : null,
        ),
        note:
          state === 'ok'
            ? 'Reporting on schedule. What it says below is current.'
            : state === 'stale'
              ? 'Too long since the last report to trust what it says. Anything shown for this host may already have ended.'
              : 'This host has never reported. There is nothing to be stale — there is nothing at all.',
      };
    });

    const quotas: QuotaAccount[] = hostNames.map((name) =>
      quotaAccount(
        name,
        scopeWords(views[name], declarations?.byHost?.[name]?.scope ?? null),
        budgets[name]?.claude ?? null,
        now,
      ),
    );

    // Per-host 5-hour headroom, reused by every card that runs on that host.
    const windowLeft = new Map<string, number | null>(
      quotas.map((q) => [q.host, q.rows[0]?.leftPct ?? null]),
    );

    // --- cards --------------------------------------------------------------
    const data = readTasks();
    const cards: DecideCard[] = [];
    for (const task of data?.tasks ?? []) {
      const slug = task.component
        ? GREENLIGHT_TARGETS[task.component]?.slug
        : undefined;
      if (!slug || finished(task)) continue;
      const id = String(task.id);
      const guidance = getTaskDecision(id);
      if (!guidance?.project) continue;

      const executor = REMOTE_EXECUTORS[guidance.project] ?? null;
      const host = executor ?? thisMachine();
      const state = cardState({
        greenlit: guidance.greenlit,
        outboxState: guidance.outboxState,
        existingDecision: guidance.existing?.decision ?? null,
      });
      const hostView = views[host];
      const age = newestAge(hostView);
      const hs = hostState(age);
      const left = windowLeft.get(host) ?? null;

      cards.push({
        id,
        scope: task.scope === 'work' ? 'company' : 'personal',
        host,
        title: task.name,
        meta: cardMeta(task),
        state,
        stateNote: stateNote(state, guidance.outboxState),
        project: guidance.project,
        scopeNote:
          task.scope === 'work'
            ? `Runs on ${host} and spends that machine’s company account window.`
            : `Runs on ${host} and spends the personal account’s window.`,
        writeLine: writeLine({
          deliveryMode: guidance.deliveryMode,
          path:
            guidance.deliveryMode === 'remote-queue'
              ? join(outboxDirLabel(), guidance.project, `${id}.json`)
              : greenlightPath(guidance.project),
          line:
            guidance.deliveryMode === 'remote-queue'
              ? `"id": "${id}"`
              : lineFor(task, guidance.project, guidance.executionPlan),
          executor,
        }),
        hostStateLine:
          age === null ? 'never reported' : `${hs} · reported ${ageWords(age)}`,
        hostStateStatus: hs === 'ok' ? 'ok' : 'warn',
        quotaLine:
          left === null
            ? `not reported — no 5-hour figure from ${host}`
            : `${left}% of the 5-hour window left on ${host}`,
        quotaStatus: left === null ? 'warn' : remainingStatus(left),
        greenlightLine:
          guidance.deliveryMode === 'remote-queue'
            ? `queued to ${executor ?? 'the remote executor'} · ${guidance.outboxState}`
            : `${greenlightPath(guidance.project)} · ${greenlightLabel(greenlitCount(guidance.project))}`,
        caution: cautionFor({
          hostStale: hs !== 'ok',
          host,
          points: task.points,
          windowLeftPct: left,
        }),
      });
    }

    const rank: Record<DecideCard['state'], number> = {
      pending: 0,
      held: 1,
      cleared: 2,
    };
    cards.sort(
      (a, b) =>
        rank[a.state] - rank[b.state] ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );

    // --- running now --------------------------------------------------------
    const byId = new Map(
      (data?.tasks ?? []).map((t) => [String(t.id), t] as const),
    );
    const running: RunningRun[] = openRuns(readRuns(usageDir())).map((run) => {
      const key = run.task_id ?? run.task ?? '';
      const task = byId.get(key);
      const started = run.started_at ? Date.parse(run.started_at) : Number.NaN;
      return {
        id: key || 'unknown task',
        scope: task?.scope === 'work' ? 'company' : 'personal',
        host: run.machine ?? 'unreported host',
        title: task?.name ?? run.task ?? 'no title on this run row',
        meta: task
          ? cardMeta(task)
          : `${run.project ?? 'no project'} · ${run.executor ?? 'no executor'}`,
        startedAtMs: Number.isFinite(started) ? started : null,
      };
    });

    const view: DecideView = {
      cards,
      quotas,
      running,
      hosts,
      // Straight off the file `readTasks` already read for the cards, so the
      // age cannot disagree with the queue it describes.
      syncedAt: data?.synced_at ?? null,
      writtenAt: data?.written_at ?? null,
      now,
    };
    return Response.json(view);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

/** Label for the outbox root, matching `greenlightOutbox.outboxDir()`. */
function outboxDirLabel(): string {
  return (
    process.env.LOOP_GREENLIGHT_OUTBOX_DIR ??
    join(process.env.HOME ?? '', '.claude', 'loop', 'greenlight-outbox')
  );
}

/**
 * Ids cleared on *this* machine, counted from the allowlist files themselves.
 *
 * Every `<slug>.md` under the greenlight directory, not only the slugs
 * `GREENLIGHT_TARGETS` knows about: this host's real allowlist is a personal
 * project the decision engine has no target for, and summing only the targets
 * would report `no ids cleared` for a file that currently holds three. A count
 * that is wrong in the reassuring direction is worse than no count.
 *
 * Only ever called for this host. Another machine's allowlist lives on that
 * machine, so its card is given `null` -- "not readable from here" -- rather
 * than a zero nothing counted.
 */
function localGreenlitTotal(): number | null {
  let names: string[];
  try {
    names = readdirSync(greenlightDir());
  } catch {
    return null; // no allowlist directory on this host at all
  }
  let total = 0;
  for (const name of names) {
    const slug = /^(.+)\.md$/.exec(name)?.[1];
    if (!slug) continue;
    total += greenlitCount(slug);
  }
  return total;
}
