export { default as AiCapability } from './AiCapability.vue';
export {
  destroy,
  detectCapability,
  enableModel,
  selectTool,
} from './language-model';
export type { SummarizeFailure, SummarizeOptions } from './summarizer';
export {
  destroySummarizer,
  detectSummarizerCapability,
  summarize,
  SUMMARIZE_TIMEOUT_MS,
  SummarizeError,
} from './summarizer';
export type { AiState, ToolDescriptor } from './types';
export { useLanguageModel } from './use-language-model';
export { useSummarizer } from './use-summarizer';
export type { AgentToolRegistration } from './webmcp';
export { registerAgentTools } from './webmcp';
