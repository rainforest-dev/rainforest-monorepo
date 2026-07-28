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
  it('no-ops and reports false when WebMCP is absent', () => {
    // This is every browser today — the default path, not an edge case.
    expect(registerAgentTools(TOOLS, new AbortController().signal)).toBe(false);
  });

  it('registers each tool with the abort signal when WebMCP exists', () => {
    const registerTool = vi.fn();
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTool },
    });
    const controller = new AbortController();

    expect(registerAgentTools(TOOLS, controller.signal)).toBe(true);
    expect(registerTool).toHaveBeenCalledTimes(1);

    const [descriptor, options] = registerTool.mock.calls[0];
    expect(descriptor.name).toBe('get_skills');
    expect(descriptor.inputSchema).toEqual(TOOLS[0].inputSchema);
    expect(descriptor.annotations).toEqual({ readOnlyHint: true });
    expect(options).toEqual({ signal: controller.signal });
  });
});
