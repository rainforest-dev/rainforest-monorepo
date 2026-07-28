import type { ToolDescriptor } from './types';

type ModelContext = {
  registerTool: (
    descriptor: ToolDescriptor & { annotations: { readOnlyHint: boolean } },
    options: { signal: AbortSignal },
  ) => void;
};

/** What the caller gets back: whether anything was registered, and the one way to undo it. */
export interface AgentToolRegistration {
  /** False when WebMCP is unavailable — which is every browser today. */
  registered: boolean;
  /** Unregisters everything this call registered. Idempotent, and a no-op when nothing was. */
  dispose: () => void;
}

/**
 * Expose tools to external agents via WebMCP.
 *
 * `document.modelContext` exists in no shipping browser as of 2026-07-28 (verified: Chrome 150,
 * Edge 150, Chromium 148), so this registers nothing and reports `registered: false` today. It is
 * built now because WebMCP's `inputSchema` is JSON Schema — the same shape `selectTool()` passes
 * as `responseConstraint` — so one descriptor serves both and they cannot drift.
 *
 * Deliberately NOT part of `AiState`: WebMCP availability is orthogonal to whether the local
 * model can run, and conflating them would let one break the other.
 *
 * WebMCP has no `unregisterTool()` — aborting the signal you registered with is the only way to
 * remove a tool. So this owns the `AbortController` and hands back a `dispose`, rather than
 * taking a signal: a caller cannot forget to abort a controller it never created. Requiring a
 * signal instead would only look safe — `registerAgentTools(tools, new AbortController().signal)`
 * type-checks and leaks exactly as much as passing nothing at all.
 */
export function registerAgentTools(
  tools: ToolDescriptor[],
): AgentToolRegistration {
  const context = (document as Document & { modelContext?: ModelContext })
    .modelContext;
  if (!context?.registerTool) {
    return { registered: false, dispose: () => undefined };
  }

  const controller = new AbortController();
  for (const tool of tools) {
    // Every tool here reads profile data and mutates nothing.
    context.registerTool(
      { ...tool, annotations: { readOnlyHint: true } },
      { signal: controller.signal },
    );
  }

  // `abort()` is itself idempotent, so repeat disposal needs no extra bookkeeping.
  return { registered: true, dispose: () => controller.abort() };
}
