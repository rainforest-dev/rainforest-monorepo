import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ToolDescriptor } from './types';
import { registerAgentTools } from './webmcp';

const TOOLS: ToolDescriptor[] = [
  {
    name: 'get_skills',
    description: 'List technical skills',
    inputSchema: { type: 'object', properties: {} },
    execute: () => ['typescript'],
  },
];

afterEach(() => {
  Reflect.deleteProperty(document, 'modelContext');
});

describe('registerAgentTools', () => {
  it('registers nothing when WebMCP is absent', () => {
    // This is every browser today — the default path, not an edge case.
    expect(registerAgentTools(TOOLS).registered).toBe(false);
  });

  it('returns a dispose that is safe to call when nothing was registered', () => {
    // Callers wire dispose into teardown unconditionally; it must not care whether the
    // registration actually happened.
    expect(() => registerAgentTools(TOOLS).dispose()).not.toThrow();
  });

  it('registers each tool when WebMCP exists', () => {
    const registerTool = vi.fn();
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTool },
    });

    expect(registerAgentTools(TOOLS).registered).toBe(true);
    expect(registerTool).toHaveBeenCalledTimes(1);

    const [descriptor, options] = registerTool.mock.calls[0];
    expect(descriptor.name).toBe('get_skills');
    expect(descriptor.inputSchema).toEqual(TOOLS[0].inputSchema);
    expect(descriptor.annotations).toEqual({ readOnlyHint: true });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.signal.aborted).toBe(false);
  });

  it('dispose aborts the signal the tools were registered with', () => {
    // The whole point of owning the controller: unregistering is not the caller's to forget.
    const registerTool = vi.fn();
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTool },
    });

    const { dispose } = registerAgentTools(TOOLS);
    const { signal } = registerTool.mock.calls[0][1];

    expect(signal.aborted).toBe(false);
    dispose();
    expect(signal.aborted).toBe(true);
  });

  it('dispose is idempotent', () => {
    const registerTool = vi.fn();
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTool },
    });

    const { dispose } = registerAgentTools(TOOLS);
    dispose();
    expect(() => dispose()).not.toThrow();
    expect(registerTool.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('gives each registration its own signal, so disposing one leaves the other live', () => {
    // Two consumers can share a page. One unmounting must not silently unregister the other's
    // tools — a shared controller would do exactly that.
    const registerTool = vi.fn();
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTool },
    });

    const first = registerAgentTools(TOOLS);
    registerAgentTools(TOOLS); // second consumer; we only need its signal below
    const firstSignal = registerTool.mock.calls[0][1].signal;
    const secondSignal = registerTool.mock.calls[1][1].signal;

    first.dispose();

    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);
  });
});
