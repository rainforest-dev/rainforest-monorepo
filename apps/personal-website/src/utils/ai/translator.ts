import { withProbeTimeout } from './probe';
import type { AiState } from './types';

/**
 * The Translator API, wrapped like `summarizer.ts` — same `AiState`, same lazy session, same
 * "classify the failure, never swallow it" stance.
 *
 * The difference that shapes this module: Translator models are per **language pair**, not one
 * model with options. `availability()` answers about a pair, `create()` binds to a pair, and a
 * session for en→zh-Hant cannot translate zh-Hant→en. So the session cache is keyed by pair, and
 * every entry point takes one.
 *
 * Like Summarizer, this ships where the Prompt API does not — measured 2026-07-29, Edge 150 has
 * Translator and no `LanguageModel`.
 */

export interface LanguagePair {
  sourceLanguage: string;
  targetLanguage: string;
}

type TranslatorSession = {
  translate: (input: string, opts?: unknown) => Promise<string>;
  destroy: () => void;
};

declare const Translator: {
  availability: (pair: LanguagePair) => Promise<string>;
  create: (opts: Record<string, unknown>) => Promise<TranslatorSession>;
};

/** Availability for one pair. A pair the platform cannot serve reports `unavailable`. */
export async function detectTranslatorCapability(
  pair: LanguagePair,
): Promise<AiState> {
  if (typeof Translator === 'undefined') return { kind: 'unsupported' };

  // A hung probe is treated as a no. This is the exact call measured hanging in Chromium 150;
  // see ./probe.
  const availability = await withProbeTimeout(
    Translator.availability(pair),
    'unavailable',
  );
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

let session: TranslatorSession | null = null;
let sessionKey = '';

/** Test-only: clear module state between cases. */
export function __resetForTests(): void {
  session = null;
  sessionKey = '';
}

const keyOf = (pair: LanguagePair) =>
  `${pair.sourceLanguage}->${pair.targetLanguage}`;

async function ensureSession(
  pair: LanguagePair,
  onProgress?: (progress: number) => void,
): Promise<TranslatorSession> {
  const key = keyOf(pair);
  if (session && sessionKey === key) return session;

  session?.destroy();
  session = await Translator.create({
    ...pair,
    monitor(monitor: EventTarget) {
      monitor.addEventListener('downloadprogress', (event) => {
        const { loaded, total } = event as Event & {
          loaded: number;
          total: number;
        };
        onProgress?.(total > 0 ? loaded / total : 0);
      });
    },
  });
  sessionKey = key;
  return session;
}

/**
 * Rejects when `signal` aborts, so a phase that cannot take a signal can still be bounded.
 *
 * `create()` accepts no AbortSignal: a download that never progresses ignores the controller
 * entirely, and awaiting it directly would hang past every timeout with the UI stuck busy. Racing
 * the creation against this turns the timer into something that actually fires. The losing
 * creation promise is left to settle on its own — it may still cache a session, which a later
 * call is free to reuse.
 */
function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    const fail = () => reject(new DOMException('aborted', 'AbortError'));
    if (signal.aborted) fail();
    else signal.addEventListener('abort', fail, { once: true });
  });
}

/**
 * Ceiling for the batch itself, once a session exists. Higher than the summarizer's because a
 * page's worth of paragraphs goes through one session.
 */
export const TRANSLATE_TIMEOUT_MS = 120_000;

/** Separate ceiling for opening the session — see DOWNLOAD_TIMEOUT_MS in ./summarizer. */
export const DOWNLOAD_TIMEOUT_MS = 600_000;

/** Same vocabulary as the summarizer, so the two features can share failure copy. */
export type TranslateFailure =
  | 'timeout'
  | 'too-long'
  | 'needs-gesture'
  | 'failed';

export class TranslateError extends Error {
  constructor(
    readonly reason: TranslateFailure,
    cause?: unknown,
  ) {
    super(`translate failed: ${reason}`, { cause });
    this.name = 'TranslateError';
  }
}

function classify(cause: unknown): TranslateFailure {
  if (cause instanceof DOMException) {
    if (cause.name === 'AbortError') return 'timeout';
    if (cause.name === 'QuotaExceededError') return 'too-long';
    // The platform refuses to start a pair's download outside a user gesture.
    if (cause.name === 'NotAllowedError') return 'needs-gesture';
  }
  return 'failed';
}

/**
 * Translates `chunks` through one session, preserving order and count.
 *
 * Takes an array rather than a string because the caller is translating a page: each chunk is one
 * paragraph, and it needs them back one-to-one to put them where they came from. Joining them into
 * a single string and splitting the result would depend on the model preserving the separator,
 * which is not something to rely on.
 *
 * Sequential, not `Promise.all`: the session is a single resource, and firing a page's worth of
 * paragraphs at it concurrently produced no speedup worth the risk of overlapping calls.
 */
export async function translateChunks(
  chunks: readonly string[],
  pair: LanguagePair,
  hooks: {
    signal?: AbortSignal;
    onProgress?: (progress: number) => void;
    onChunk?: (index: number, text: string) => void;
  } = {},
): Promise<string[]> {
  const controller = new AbortController();
  // Download budget first, then re-armed at the batch budget — see ./summarizer for why these are
  // separate. Edge 150 with an empty cache is what proved one shared timer wrong.
  let timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();

  if (hooks.signal?.aborted) controller.abort();
  else hooks.signal?.addEventListener('abort', onCallerAbort, { once: true });

  try {
    const active = await Promise.race([
      ensureSession(pair, hooks.onProgress),
      rejectOnAbort(controller.signal),
    ]);
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), TRANSLATE_TIMEOUT_MS);
    if (controller.signal.aborted) {
      throw new DOMException('aborted', 'AbortError');
    }

    const results: string[] = [];
    for (const [index, chunk] of chunks.entries()) {
      if (controller.signal.aborted) {
        throw new DOMException('aborted', 'AbortError');
      }
      const translated = await active.translate(chunk, {
        signal: controller.signal,
      });
      results.push(translated);
      // Emitted per chunk so the caller can swap paragraphs in as they land, rather than leaving
      // the reader on an unchanged page for the whole batch.
      hooks.onChunk?.(index, translated);
    }
    return results;
  } catch (cause) {
    throw new TranslateError(classify(cause), cause);
  } finally {
    clearTimeout(timer);
    hooks.signal?.removeEventListener('abort', onCallerAbort);
  }
}

/** Releases the live session. */
export function destroyTranslator(): void {
  session?.destroy();
  session = null;
  sessionKey = '';
}
