import type { AiState } from './types';

/**
 * The Summarizer API, wrapped the same way `language-model.ts` wraps the Prompt API — same state
 * union, same lazy-session rule, same "a failure is reported, never swallowed" stance.
 *
 * Why a second module rather than a generalized one: the two APIs share a capability *vocabulary*
 * (`availability()` returning unavailable/downloadable/downloading/available) but nothing else.
 * Summarizer takes configured sessions and plain text; the Prompt API takes a schema and returns
 * constrained JSON. Folding them together would mean a wrapper whose options are a union of two
 * disjoint shapes, so they stay separate and share only `AiState`.
 *
 * Worth knowing: Summarizer ships in browsers where the Prompt API does not. Measured 2026-07-29 —
 * Edge 150 has Summarizer and Translator but no `LanguageModel` at all. A feature built on this
 * reaches strictly more people than one built on the palette's `selectTool`.
 */

/** Mirrors the platform's option bag; narrowed to what this site actually uses. */
export interface SummarizeOptions {
  type?: 'key-points' | 'tldr' | 'teaser' | 'headline';
  format?: 'markdown' | 'plain-text';
  length?: 'short' | 'medium' | 'long';
}

type SummarizerSession = {
  summarize: (input: string, opts?: unknown) => Promise<string>;
  destroy: () => void;
};

declare const Summarizer: {
  availability: (opts?: SummarizeOptions) => Promise<string>;
  create: (opts?: Record<string, unknown>) => Promise<SummarizerSession>;
};

/**
 * Availability for a *specific* configuration. The platform answers per option bag — a config it
 * cannot serve reports `unavailable` even when another one is `available` — so callers must probe
 * with the same options they intend to run with, which is why this takes them.
 */
export async function detectSummarizerCapability(
  options: SummarizeOptions = {},
): Promise<AiState> {
  if (typeof Summarizer === 'undefined') return { kind: 'unsupported' };

  const availability = await Summarizer.availability(options);
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

let session: SummarizerSession | null = null;
let sessionKey = '';

/** Test-only: clear module state between cases. */
export function __resetForTests(): void {
  session = null;
  sessionKey = '';
}

const keyOf = (options: SummarizeOptions) =>
  `${options.type ?? ''}|${options.format ?? ''}|${options.length ?? ''}`;

/**
 * Opens a session for `options`, reusing the live one when the configuration matches.
 *
 * Sessions are configuration-bound: asking for a headline through a session created for key-points
 * returns key-points. Keying the cache on the options — rather than holding one session like the
 * Prompt API wrapper does — is what lets a page offer more than one summary shape without silently
 * serving the wrong one.
 */
async function ensureSession(
  options: SummarizeOptions,
  onProgress?: (progress: number) => void,
): Promise<SummarizerSession> {
  const key = keyOf(options);
  if (session && sessionKey === key) return session;

  session?.destroy();
  session = await Summarizer.create({
    ...options,
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
 * Wall-clock ceiling for one summarization, generous because the input is a whole article rather
 * than a sentence. As with the Prompt API wrapper this bounds a hung call; it is not a target.
 */
export const SUMMARIZE_TIMEOUT_MS = 60_000;

/**
 * Distinguishes what the reader should be told. `unsupported` never reaches here — the UI hides.
 *
 * `needs-gesture` is its own case because it is the only one the reader can act on: the platform
 * refuses `create()` outside a user gesture whenever the model still has to be downloaded
 * (`NotAllowedError: Requires a user gesture when availability is "downloading" or "downloadable"`).
 * A real click satisfies it; anything that reaches `summarize()` on a timer, from a lifecycle hook,
 * or after an await that spent the activation does not.
 */
export type SummarizeFailure =
  | 'timeout'
  | 'too-long'
  | 'needs-gesture'
  | 'failed';

export class SummarizeError extends Error {
  constructor(
    readonly reason: SummarizeFailure,
    cause?: unknown,
  ) {
    super(`summarize failed: ${reason}`, { cause });
    this.name = 'SummarizeError';
  }
}

/**
 * Summarizes `text`, throwing a `SummarizeError` whose `reason` the UI can render.
 *
 * Every failure is classified rather than collapsed into one silent nothing. That is a direct
 * lesson from the command palette: a bare catch there made three unrelated defects — a missing
 * session, a rejected argument, and a timeout — indistinguishable from "nothing to say", and two
 * of them survived review because of it.
 */
export async function summarize(
  text: string,
  options: SummarizeOptions = {},
  hooks: { signal?: AbortSignal; onProgress?: (progress: number) => void } = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUMMARIZE_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();

  // Wired before opening the session, and the timeout covers session creation too: a first run
  // includes a model download, which is the part most likely to hang.
  if (hooks.signal?.aborted) controller.abort();
  else hooks.signal?.addEventListener('abort', onCallerAbort, { once: true });

  try {
    const active = await ensureSession(options, hooks.onProgress);
    // Opening the session is awaitable, so the caller may have aborted meanwhile. Throw rather
    // than hand `summarize()` a spent signal — its `abort` event has already fired and fires only
    // once, so an implementation that merely subscribes would hang until the timeout.
    if (controller.signal.aborted) {
      throw new DOMException('aborted', 'AbortError');
    }
    return await active.summarize(text, { signal: controller.signal });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw new SummarizeError('timeout', cause);
    }
    // The platform rejects oversized input with QuotaExceededError. It is worth its own message:
    // unlike a generic failure, retrying the same article cannot help.
    if (cause instanceof DOMException && cause.name === 'QuotaExceededError') {
      throw new SummarizeError('too-long', cause);
    }
    // Opposite of the above: retrying is exactly what helps, provided the retry is a real click.
    if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
      throw new SummarizeError('needs-gesture', cause);
    }
    throw new SummarizeError('failed', cause);
  } finally {
    clearTimeout(timer);
    hooks.signal?.removeEventListener('abort', onCallerAbort);
  }
}

/** Releases the live session. Callers that own the page should do this on teardown. */
export function destroySummarizer(): void {
  session?.destroy();
  session = null;
  sessionKey = '';
}
