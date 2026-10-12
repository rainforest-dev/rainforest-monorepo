import {
  acquire,
  detectCapability,
  enableModel,
  type LanguageOptions,
  selectTool,
} from './language-model';
import type { AiState } from './types';

export type AiController = {
  getState(): AiState;
  subscribe(listener: () => void): () => void;
  refresh(languages?: LanguageOptions): Promise<AiState>;
  enable(languages?: LanguageOptions): Promise<void>;
  run<T>(
    prompt: string,
    schema: Record<string, unknown>,
    opts?: { signal?: AbortSignal; languages?: LanguageOptions },
  ): Promise<T>;
  retain(): () => void;
};

export function createAiController(): AiController {
  let state: AiState = { kind: 'unsupported' };
  let epoch = 0;
  let enabling = false;
  const listeners = new Set<() => void>();
  const set = (next: AiState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const controller: AiController = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async refresh(languages) {
      const at = epoch;
      const next = await detectCapability(languages);
      if (at === epoch && !enabling) set(next);
      return next;
    },
    async enable(languages) {
      epoch++;
      enabling = true;
      set({ kind: 'downloading', progress: 0 });
      try {
        await enableModel(
          (progress) => set({ kind: 'downloading', progress }),
          languages,
        );
        set({ kind: 'ready' });
      } catch (error) {
        enabling = false;
        await controller.refresh(languages).catch(() => undefined);
        throw error;
      } finally {
        enabling = false;
        epoch++;
      }
    },
    async run(prompt, schema, opts = {}) {
      try {
        return await selectTool(prompt, schema, opts);
      } catch (error) {
        if (!opts.signal?.aborted)
          await controller.refresh(opts.languages).catch(() => undefined);
        throw error;
      }
    },
    retain: acquire,
  };
  return controller;
}
