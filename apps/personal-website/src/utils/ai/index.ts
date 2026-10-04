export { default as AiCapability } from './AiCapability.vue';
export type { SummarizeFailure, SummarizeOptions } from './summarizer';
export {
  destroySummarizer,
  detectSummarizerCapability,
  summarize,
  SUMMARIZE_TIMEOUT_MS,
  SummarizeError,
} from './summarizer';
export type { LanguagePair, TranslateFailure } from './translator';
export {
  destroyTranslator,
  detectTranslatorCapability,
  TRANSLATE_TIMEOUT_MS,
  translateChunks,
  TranslateError,
} from './translator';
export { useLanguageModel } from './use-language-model';
export { useSummarizer } from './use-summarizer';
export type { AgentToolRegistration } from './webmcp';
export { registerAgentTools } from './webmcp';
export type { AiState, ToolDescriptor } from '@rainforest-dev/web-ai';
export {
  destroy,
  detectCapability,
  enableModel,
  selectTool,
} from '@rainforest-dev/web-ai';
export { PROBE_TIMEOUT_MS, withProbeTimeout } from '@rainforest-dev/web-ai';
