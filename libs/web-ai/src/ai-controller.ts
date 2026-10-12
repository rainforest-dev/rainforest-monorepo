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
      set(await detectCapability(languages));
      return state;
    },
    async enable(languages) {
      set({ kind: 'downloading', progress: 0 });
      try {
        await enableModel(
          (progress) => set({ kind: 'downloading', progress }),
          languages,
        );
        set({ kind: 'ready' });
      } catch (error) {
        await controller.refresh(languages);
        throw error;
      }
    },
    async run(prompt, schema, opts = {}) {
      try {
        return await selectTool(prompt, schema, opts);
      } catch (error) {
        await controller.refresh(opts.languages);
        throw error;
      }
    },
    retain: acquire,
  };
  return controller;
}
