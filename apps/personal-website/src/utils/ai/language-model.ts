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
