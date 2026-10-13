import type { AiState } from '@rainforest-dev/web-ai';
import { createAiController } from '@rainforest-dev/web-ai';
import { onUnmounted, readonly, ref } from 'vue';

const controller = createAiController();

export function useLanguageModel() {
  const state = ref<AiState>(controller.getState());
  const error = ref<Error | null>(null);
  const unsubscribe = controller.subscribe(() => {
    state.value = controller.getState();
  });

  async function refresh(): Promise<void> {
    await controller.refresh();
  }

  async function enable(): Promise<void> {
    error.value = null;
    try {
      await controller.enable();
    } catch (cause) {
      error.value = cause as Error;
    }
  }

  async function selectTool<T>(
    query: string,
    schema: Record<string, unknown>,
  ): Promise<T | null> {
    try {
      return await controller.run<T>(query, schema);
    } catch (cause) {
      error.value = cause as Error;
      return null;
    }
  }

  const release = controller.retain();
  onUnmounted(() => {
    unsubscribe();
    release();
  });

  return {
    state: readonly(state),
    error: readonly(error),
    refresh,
    enable,
    selectTool,
  };
}
