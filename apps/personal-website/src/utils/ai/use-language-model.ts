import { onUnmounted, readonly, ref } from 'vue';

import {
  destroy,
  detectCapability,
  enableModel as enableModelCore,
  selectTool as selectToolCore,
} from './language-model';
import type { AiState } from './types';

/**
 * Vue adapter over the framework-agnostic core. Holds no logic of its own beyond reactivity and
 * cleanup — everything fragile lives in language-model.ts so a React consumer could reuse it.
 *
 * ONE SESSION PER PAGE. The core keeps a single module-level session, so two components each
 * calling `enable()`/unmounting will fight over it: whichever unmounts first destroys the session
 * the other is still using. Until ownership is designed properly, use this from ONE component per
 * page.
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

  onUnmounted(destroy);

  return {
    state: readonly(state),
    error: readonly(error),
    refresh,
    enable,
    selectTool,
  };
}
