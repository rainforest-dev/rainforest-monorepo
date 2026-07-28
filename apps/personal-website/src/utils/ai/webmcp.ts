import type { ToolDescriptor } from './types';

type ModelContext = {
  registerTool: (
    descriptor: ToolDescriptor & { annotations: { readOnlyHint: boolean } },
    options: { signal: AbortSignal },
  ) => void;
};

/**
 * Expose tools to external agents via WebMCP.
 *
 * `document.modelContext` exists in no shipping browser as of 2026-07-28 (verified: Chrome 150,
 * Edge 150, Chromium 148), so this returns false and does nothing today. It is built now because
 * WebMCP's `inputSchema` is JSON Schema — the same shape `selectTool()` passes as
 * `responseConstraint` — so one descriptor serves both and they cannot drift.
 *
 * Deliberately NOT part of `AiState`: WebMCP availability is orthogonal to whether the local
 * model can run, and conflating them would let one break the other.
 *
 * Unregistration is via `signal` only — WebMCP has no `unregisterTool()`. This function owns that
 * contract so consumers cannot leak registrations across route changes.
 */
export function registerAgentTools(
  tools: ToolDescriptor[],
  signal: AbortSignal,
): boolean {
  const context = (document as Document & { modelContext?: ModelContext })
    .modelContext;
  if (!context?.registerTool) return false;

  for (const tool of tools) {
    // Every tool here reads profile data and mutates nothing.
    context.registerTool(
      { ...tool, annotations: { readOnlyHint: true } },
      { signal },
    );
  }
  return true;
}
