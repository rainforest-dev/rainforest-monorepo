import { onUnmounted, readonly, ref } from 'vue';

import {
  destroySummarizer,
  detectSummarizerCapability,
  summarize as summarizeCore,
  SummarizeError,
  type SummarizeFailure,
  type SummarizeOptions,
} from './summarizer';
import type { AiState } from './types';

/**
 * Vue adapter over `summarizer.ts`. Reactivity and cleanup only — everything fragile stays in the
 * core so a non-Vue consumer could reuse it.
 *
 * Note what this deliberately does NOT do: convert a failure into `null`. `useLanguageModel` does
 * exactly that, and it cost real debugging time — a timeout reached the palette as an empty result
 * with the reason parked in a separate ref, so the branch that should have said "took too long"
 * was unreachable and silently said "couldn't answer" instead. Here the reason IS the state the
 * template renders.
 */
export function useSummarizer(options: SummarizeOptions = {}) {
  const state = ref<AiState>({ kind: 'unsupported' });
  const summary = ref<string | null>(null);
  const failure = ref<SummarizeFailure | null>(null);
  const busy = ref(false);
  const progress = ref(0);

  async function refresh(): Promise<void> {
    state.value = await detectSummarizerCapability(options);
  }

  /**
   * Summarizes `text`. Resolves either way — the outcome is in `summary`/`failure`, so a caller
   * wiring this to a click handler never needs its own try/catch to keep the UI honest.
   */
  async function run(text: string): Promise<void> {
    if (busy.value) return;
    busy.value = true;
    summary.value = null;
    failure.value = null;
    progress.value = 0;
    try {
      summary.value = await summarizeCore(text, options, {
        onProgress: (value) => {
          progress.value = value;
          // Surfacing the download as its own state keeps a first run from looking like a hang:
          // the model is hundreds of megabytes and the wait is otherwise unexplained.
          if (value < 1) state.value = { kind: 'downloading', progress: value };
        },
      });
      state.value = { kind: 'ready' };
    } catch (cause) {
      failure.value = cause instanceof SummarizeError ? cause.reason : 'failed';
      // Re-read rather than assume: a run can fail because the capability changed underneath
      // (model evicted, browser updated), not only because this attempt went wrong.
      await refresh();
    } finally {
      busy.value = false;
    }
  }

  /** Clears the panel without re-probing — for closing the summary and starting over. */
  function reset(): void {
    summary.value = null;
    failure.value = null;
  }

  onUnmounted(destroySummarizer);

  return {
    state: readonly(state),
    summary: readonly(summary),
    failure: readonly(failure),
    busy: readonly(busy),
    progress: readonly(progress),
    refresh,
    run,
    reset,
  };
}
