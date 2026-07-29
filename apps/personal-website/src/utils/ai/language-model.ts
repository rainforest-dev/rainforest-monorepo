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
  consumers = 0;
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

type Session = {
  prompt: (input: string, opts?: unknown) => Promise<string>;
  destroy: () => void;
};

let session: Session | null = null;

/**
 * Starts the model download and opens a session.
 *
 * MUST be called synchronously from a click handler. The first `create()` triggers a
 * multi-hundred-megabyte download and throws `NotAllowedError` outside a user gesture, so this
 * cannot be called on ⌘K-open or on keystroke — consumers wire it to an explicit control.
 *
 * There is ONE session per page. Calling this again replaces the previous one, releasing it first
 * so a double-click or a re-mounting component can't strand a session holding the model in memory.
 * Consumers sharing a page must coordinate `enableModel`/`destroy` between themselves.
 */
export async function enableModel(
  onProgress?: (progress: number) => void,
): Promise<void> {
  if (typeof LanguageModel === 'undefined') {
    throw new Error('Prompt API is not available in this browser');
  }

  // Release any existing session before overwriting the reference — otherwise the old one leaks,
  // which is the exact thing destroy()'s "platform requires explicit release" note warns about.
  session?.destroy();

  session = (await LanguageModel.create({
    // Output is pinned to English: non-English replies are unreliable on current on-device models.
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
    monitor(m: EventTarget) {
      m.addEventListener('downloadprogress', (event) => {
        const { loaded, total } = event as Event & {
          loaded: number;
          total: number;
        };
        onProgress?.(total > 0 ? loaded / total : 0);
      });
    },
  })) as unknown as Session;
}

/**
 * The live session, opening one first if there isn't one.
 *
 * Returns it rather than relying on the module-level `session` staying narrowed: an `await`
 * between the null check and the use invalidates TypeScript's narrowing, and silencing that with
 * `!` would assert something this function is better off actually proving.
 *
 * Opening on demand is what makes the `ready` path work at all. `ready` is reached only when
 * availability is already `available`, meaning the weights are on disk and `create()` neither
 * downloads nor needs a user gesture — the gesture requirement documented on `enableModel` is
 * about the `downloadable` path, which still goes through the explicit control.
 */
async function ensureSession(): Promise<Session> {
  if (!session) await enableModel();
  if (!session) throw new Error('Could not open a language model session');
  return session;
}

/** Wall-clock bound on a single run. The abort is what the platform honours — we ask it to
 *  stop rather than assuming we can interrupt inference ourselves.
 *
 *  A ceiling for a call that has hung, deliberately far above any healthy run. Typical constrained
 *  runs against Chrome 150 land near a second; the 20–40s runs that originally forced this value up
 *  from 20s turned out to be self-inflicted — an unconstrained string field in the caller's schema
 *  invited the model to write an essay into it. Callers own their schemas, so this stays generous
 *  rather than tight: a bound that trips on a slow-but-working run is worse than one that lets a
 *  genuinely hung call sit a few extra seconds. */
export const RUN_TIMEOUT_MS = 30_000;

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
 * One constrained call per turn. `responseConstraint` is *supposed* to guarantee schema-valid
 * JSON by construction — but we parse defensively rather than trust it, because a browser that
 * accepts the option and then ignores it is exactly the failure this function must detect.
 *
 * If the FIRST call fails — including failing to parse — we treat it as rung 3 of the capability
 * ladder failing and degrade to `unsupported`. After one success we never blame the browser again:
 * a later error is transient, not a capability verdict. Aborts are excluded either way, since a
 * timeout says nothing about whether constraints are supported.
 */
export async function selectTool<T>(
  query: string,
  schema: Record<string, unknown>,
  opts: { signal?: AbortSignal } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();

  // An `abort` listener never fires on a signal that is ALREADY aborted — the event fires once,
  // when abort() is called. Subscribing alone would let a pre-aborted caller signal run the full
  // RUN_TIMEOUT_MS as if nothing were wrong, so check the current state first.
  //
  // This is wired up BEFORE opening the session, and the timeout covers that too: the whole
  // operation is what the caller asked to bound, not just the inference part of it.
  if (opts.signal?.aborted) {
    controller.abort();
  } else {
    opts.signal?.addEventListener('abort', onCallerAbort, { once: true });
  }

  try {
    const active = await ensureSession();
    // Opening a session is itself awaitable, so the caller can abort while it is in flight. Do
    // not hand an already-aborted signal to `prompt()` and hope: its `abort` event has already
    // fired and fires only once, so an implementation that merely subscribes would hang until
    // the timeout — the same one-shot-event trap guarded above, reachable a level up.
    if (controller.signal.aborted) {
      throw new DOMException('aborted', 'AbortError');
    }
    const raw = await active.prompt(query, {
      responseConstraint: schema,
      signal: controller.signal,
    });
    const parsed = JSON.parse(raw) as T;
    hasSucceededOnce = true;
    return parsed;
  } catch (error) {
    const aborted =
      error instanceof DOMException && error.name === 'AbortError';
    if (!hasSucceededOnce && !aborted) markProbeFailed();
    throw error;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onCallerAbort);
  }
}

/**
 * Tears the session down immediately, regardless of how many consumers are live.
 *
 * Prefer `acquire()` unless you genuinely own the whole page — see below for why.
 */
export function destroy(): void {
  session?.destroy();
  session = null;
}

let consumers = 0;

/**
 * Registers a consumer and returns its release function. The session is destroyed only when the
 * LAST consumer releases.
 *
 * There is one session per page, so a consumer that tears down on its own unmount takes the
 * session out from under everyone else. That is not hypothetical: the command palette and an
 * embedded demo can share a page, and the demo unmounting on a route change would leave the
 * palette's next call throwing "enableModel() must be called before selectTool()" — recoverable
 * only by another real user gesture, which the palette has no way to stage.
 *
 * Release is idempotent per consumer, so a double-unmount can't drive the count negative and
 * free a session other consumers are still using.
 */
export function acquire(): () => void {
  consumers += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    consumers = Math.max(0, consumers - 1);
    if (consumers === 0) destroy();
  };
}
