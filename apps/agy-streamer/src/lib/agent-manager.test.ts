import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addSSEClient, getOrCreateSession, handleToolApproval } from './agent-manager';

describe('Agent Manager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should create and retrieve sessions correctly', () => {
    const session = getOrCreateSession('test-session-123');
    expect(session).toBeDefined();
    expect(session.controllers).toBeInstanceOf(Set);
    expect(session.process).toBeNull();
    expect(session.pendingResolve).toBeNull();

    // Verify retrieval of same session instance
    const secondSession = getOrCreateSession('test-session-123');
    expect(secondSession).toBe(session);
  });

  it('should manage SSE clients and clean them up', () => {
    const mockController = {
      enqueue: vi.fn(),
      close: vi.fn(),
      error: vi.fn()
    } as unknown as ReadableStreamDefaultController;

    const cleanup = addSSEClient('test-session-456', mockController);
    const session = getOrCreateSession('test-session-456');
    
    expect(session.controllers.has(mockController)).toBe(true);

    cleanup();
    expect(session.controllers.has(mockController)).toBe(false);
  });

  it('should handle tool approvals by resolving pending promises with an option index', async () => {
    const session = getOrCreateSession('test-session-789');

    let resolvedValue: number | null = null;
    const promise = new Promise<number>((resolve) => {
      session.pendingResolve = resolve;
    });

    promise.then((val) => {
      resolvedValue = val;
    });

    const approved = handleToolApproval('test-session-789', 2);
    expect(approved).toBe(true);

    const result = await promise;
    expect(result).toBe(2);
    expect(resolvedValue).toBe(2);
  });
});
