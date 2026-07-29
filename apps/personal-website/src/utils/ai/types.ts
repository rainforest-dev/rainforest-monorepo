/**
 * The single union every consumer switches on.
 *
 * `unsupported` and `unavailable` are distinct on purpose: they are different sentences to a
 * user ("this browser can't" vs "this machine can't"), and only the first is worth re-probing
 * in a different browser.
 */
export type AiState =
  | { kind: 'unsupported' }
  | { kind: 'unavailable' }
  | { kind: 'downloadable' }
  | { kind: 'downloading'; progress: number }
  | { kind: 'ready' };

/**
 * One tool, described once. `inputSchema` is JSON Schema — the same shape `selectTool()` passes
 * as `responseConstraint` and the same shape WebMCP's `registerTool()` expects. That shared
 * shape is why both live in this module: one descriptor feeds local constrained decoding and
 * remote agent registration, so the two cannot drift.
 *
 * The descriptors themselves belong to E, not here.
 */
export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
}
