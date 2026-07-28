import type { AiState } from './types';

/**
 * Bumped when the probe's meaning changes, so a browser update re-probes rather than inheriting
 * a stale "this browser can't" verdict.
 */
const PROBE_CACHE_KEY = 'rf:ai:constraint-probe:v1';

let probeFailed = false;

/** Test-only: clear module state between cases. */
export function __resetForTests(): void {
  probeFailed = false;
  hasSucceededOnce = false;
  session = null;
}

function hasProbeFailure(): boolean {
  if (probeFailed) return true;
  try {
    return sessionStorage.getItem(PROBE_CACHE_KEY) === 'failed';
  } catch {
    // Private mode or blocked storage — treat as "not yet probed" rather than failing shut.
    return false;
  }
}

/**
 * Rungs 1 and 2 of the capability ladder. Rung 3 (does `responseConstraint` actually work) needs
 * a session, which needs a download, which needs a user gesture — so it runs in `selectTool()`.
 */
export async function detectCapability(): Promise<AiState> {
  if (typeof LanguageModel === 'undefined') return { kind: 'unsupported' };
  if (hasProbeFailure()) return { kind: 'unsupported' };

  const availability = await LanguageModel.availability();
  switch (availability) {
    case 'unavailable':
      return { kind: 'unavailable' };
    case 'downloadable':
      return { kind: 'downloadable' };
    case 'downloading':
      return { kind: 'downloading', progress: 0 };
    default:
      return { kind: 'ready' };
  }
}

type Session = { prompt: (input: string, opts?: unknown) => Promise<string>; destroy: () => void };

let session: Session | null = null;

/**
 * Starts the model download and opens a session.
 *
 * MUST be called synchronously from a click handler. The first `create()` triggers a
 * multi-hundred-megabyte download and throws `NotAllowedError` outside a user gesture, so this
 * cannot be called on ⌘K-open or on keystroke — consumers wire it to an explicit control.
 */
export async function enableModel(onProgress?: (progress: number) => void): Promise<void> {
  if (typeof LanguageModel === 'undefined') {
    throw new Error('Prompt API is not available in this browser');
  }

  session = (await LanguageModel.create({
    // Output is pinned to English: non-English replies are unreliable on current on-device models.
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
    monitor(m: EventTarget) {
      m.addEventListener('downloadprogress', (event) => {
        const { loaded, total } = event as Event & { loaded: number; total: number };
        onProgress?.(total > 0 ? loaded / total : 0);
      });
    },
  } as never)) as unknown as Session;
}

/** Wall clock, not step count. On-device inference blocks the main thread, so a hung run has to
 *  be cut off by an abort signal the platform honours rather than a timer we can't fire. */
const RUN_TIMEOUT_MS = 20_000;

let hasSucceededOnce = false;

function markProbeFailed(): void {
  probeFailed = true;
  try {
    sessionStorage.setItem(PROBE_CACHE_KEY, 'failed');
  } catch {
    // Storage blocked; the in-memory flag still holds for this page.
  }
}

/**
 * One constrained call per turn. `responseConstraint` guarantees schema-valid JSON by
 * construction, so there is no free-form parse step to fail.
 *
 * If the FIRST call fails, we treat it as rung 3 of the capability ladder failing and degrade to
 * `unsupported`. After one success we never blame the browser again — a later error is transient,
 * not a capability verdict. Aborts are excluded either way: a timeout says nothing about support.
 */
export async function selectTool<T>(
  query: string,
  schema: Record<string, unknown>,
  opts: { signal?: AbortSignal } = {},
): Promise<T> {
  if (!session) throw new Error('enableModel() must be called before selectTool()');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
  opts.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const raw = await session.prompt(query, {
      responseConstraint: schema,
      signal: controller.signal,
    });
    hasSucceededOnce = true;
    return JSON.parse(raw) as T;
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    if (!hasSucceededOnce && !aborted) markProbeFailed();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Sessions hold the model in memory; the platform guidance requires explicit release. */
export function destroy(): void {
  session?.destroy();
  session = null;
}
