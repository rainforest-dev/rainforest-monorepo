import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

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

function syncServiceUrl(): string | null {
  const value = process.env.LOOP_SYNC_URL?.trim();
  return value || null;
}

function syncServiceToken(): string | null {
  const value = process.env.LOOP_SYNC_TOKEN?.trim();
  if (value) return value;
  const path = process.env.LOOP_SYNC_TOKEN_FILE?.trim();
  if (!path) return null;
  try {
    const token = readFileSync(path, 'utf8').trim();
    return token || null;
  } catch {
    return null;
  }
}

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

/** Ask the mini host's Python sync service when the app runs in a Node-only
 * container. The service owns provider credentials and the writable vault;
 * this process only reads the refreshed files afterward. */
async function runRemoteRefresh(): Promise<StepResult[]> {
  const url = syncServiceUrl();
  if (!url) return [];
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  const token = syncServiceToken();
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STEP_TIMEOUT_MS * 3);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
    });
    const payload = (await response.json()) as {
      steps?: StepResult[];
      error?: string;
    };
    if (!Array.isArray(payload.steps)) {
      return [
        {
          step: 'sync_service',
          ok: false,
          code: response.status,
          error: payload.error ?? 'invalid response',
        },
      ];
    }
    return payload.steps;
  } catch (err) {
    return [
      { step: 'sync_service', ok: false, code: null, error: String(err) },
    ];
  } finally {
    clearTimeout(timer);
  }
}

async function runRefresh(): Promise<StepResult[]> {
  if (syncServiceUrl()) return runRemoteRefresh();

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
