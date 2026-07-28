import { onUnmounted, readonly, ref } from 'vue';

import {
  acquire,
  detectCapability,
  enableModel as enableModelCore,
  selectTool as selectToolCore,
} from './language-model';
import type { AiState } from './types';

/**
 * Vue adapter over the framework-agnostic core. Holds no logic of its own beyond reactivity and
 * cleanup — everything fragile lives in language-model.ts so a React consumer could reuse it.
 *
 * ONE SESSION PER PAGE, shared by every consumer. Teardown is reference-counted via the core's
 * `acquire()`, so the session survives until the last component using it unmounts — a demo
 * unmounting on a route change no longer destroys the palette's session.
 */
export function useLanguageModel() {
  const state = ref<AiState>({ kind: 'unsupported' });
  const error = ref<Error | null>(null);

  async function refresh(): Promise<void> {
    state.value = await detectCapability();
  }

  /** Bind directly to a click handler — see enableModel() in the core. */
  async function enable(): Promise<void> {
    error.value = null;
    try {
      state.value = { kind: 'downloading', progress: 0 };
      await enableModelCore((progress) => {
        state.value = { kind: 'downloading', progress };
      });
      state.value = { kind: 'ready' };
    } catch (cause) {
      error.value = cause as Error;
      await refresh();
    }
  }

  async function selectTool<T>(
    query: string,
    schema: Record<string, unknown>,
  ): Promise<T | null> {
    try {
      return await selectToolCore<T>(query, schema);
    } catch (cause) {
      error.value = cause as Error;
      // The core may have degraded ready -> unsupported on a first-call failure; re-read rather
      // than assuming the previous state still holds.
      await refresh();
      return null;
    }
  }

  // acquire() runs now, registering this consumer; the returned release runs on unmount and
  // only tears the session down when it is the last one out.
  const release = acquire();
  onUnmounted(release);

  return {
    state: readonly(state),
    error: readonly(error),
    refresh,
    enable,
    selectTool,
  };
}
