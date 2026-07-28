export { default as AiCapability } from './AiCapability.vue';
export {
  destroy,
  detectCapability,
  enableModel,
  selectTool,
} from './language-model';
export type { AiState, ToolDescriptor } from './types';
export { useLanguageModel } from './use-language-model';
export type { AgentToolRegistration } from './webmcp';
export { registerAgentTools } from './webmcp';
