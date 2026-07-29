import { spawn } from 'node:child_process';

import type { APIRoute } from 'astro';

/**
 * Refresh the vault's usage/task data by re-running the Python heartbeat steps,
 * budget-first:
 *   1. `export_quota` — provider quota snapshots (awaited first so the budget
 *      panel is fresh before anything slower runs);
 *   2. `enrich`       — rebuild this machine's usage ledger;
 *   3. `sync_tasks --notion` — only when NOTION_TOKEN is set (read-only mirror).
 *
 * Steps are run from the vault root as `python3 -m scripts.usage.<step>`, each
 * tolerant of failure (mirrors run-hourly.sh's `|| true`) so one broken step
 * never blocks the others. A module-level lock guards against overlapping runs.
 */

interface StepResult {
  step: string;
  ok: boolean;
  code: number | null;
  skipped?: boolean;
  error?: string;
}

// Overlap guard: a single in-flight refresh shared across requests.
let inFlight: Promise<StepResult[]> | null = null;

const STEP_TIMEOUT_MS = 120_000;

function vaultBase(): string {
  return process.env.VAULT_PATH ?? '/vault';
}

/** Run one `python3 -m scripts.usage.<module>` step; never rejects. */
function runStep(step: string, args: string[] = []): Promise<StepResult> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r: StepResult) => {
      if (done) return;
      done = true;
      resolve(r);
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn('python3', ['-m', `scripts.usage.${step}`, ...args], {
        cwd: vaultBase(),
        env: process.env,
        stdio: 'ignore',
      });
    } catch (err) {
      finish({ step, ok: false, code: null, error: String(err) });
      return;
    }

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ step, ok: false, code: null, error: 'timeout' });
    }, STEP_TIMEOUT_MS);

    child.on('error', (err) => {
      clearTimeout(timer);
      finish({ step, ok: false, code: null, error: String(err) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      finish({ step, ok: code === 0, code });
    });
  });
}

async function runRefresh(): Promise<StepResult[]> {
  const results: StepResult[] = [];

  // 1. Budget first — awaited before anything else.
  results.push(await runStep('export_quota'));
  // 2. Ledger enrichment.
  results.push(await runStep('enrich'));
  // 3. Notion task mirror — only when a token is configured.
  if (process.env.NOTION_TOKEN) {
    results.push(await runStep('sync_tasks', ['--notion']));
  } else {
    results.push({ step: 'sync_tasks', ok: true, code: null, skipped: true });
  }

  return results;
}

export const POST: APIRoute = async () => {
  if (inFlight) {
    return Response.json(
      { ok: false, running: true, message: 'refresh already in progress' },
      { status: 409 },
    );
  }

  inFlight = runRefresh();
  try {
    const steps = await inFlight;
    return Response.json({ ok: steps.every((s) => s.ok), steps });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  } finally {
    inFlight = null;
  }
};
