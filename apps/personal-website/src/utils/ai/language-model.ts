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
