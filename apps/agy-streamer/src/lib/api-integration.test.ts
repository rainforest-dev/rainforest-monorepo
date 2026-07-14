import fs from 'fs/promises';
import { beforeEach,describe, expect, it, vi } from 'vitest';

import { Route as ProjectsRoute } from '../routes/api/projects';
import { Route as ApproveRoute } from '../routes/api/sessions/$sessionId/approve';
import { Route as ChatRoute } from '../routes/api/sessions/$sessionId/chat';
import { Route as SessionsRoute } from '../routes/api/sessions/index';
import { getOrCreateSession } from './agent-manager';

describe('API Route Handlers Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should list registered projects from projects directory config files', async () => {
    vi.spyOn(fs, 'readdir').mockResolvedValue(['test-project-1.json'] as any);
    vi.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({
      id: 'test-proj-id',
      name: 'My Cool Project',
      projectResources: {
        resources: [
          {
            gitFolder: {
              folderUri: 'file:///Users/rainforest/Repositories/cool-proj'
            }
          }
        ]
      }
    }));

    // `handlers` is typed as a union that TS can't statically narrow from
    // outside the route module; these are plain object handlers at runtime.
    const handler = (ProjectsRoute.options.server?.handlers as any)?.GET;
    expect(handler).toBeDefined();

    const response = await handler!({ request: new Request('http://localhost/api/projects') });
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0]).toEqual({
      id: 'test-proj-id',
      name: 'My Cool Project',
      path: '/Users/rainforest/Repositories/cool-proj'
    });
  });

  it('should list historical sessions from brain directories', async () => {
    vi.spyOn(fs, 'readdir').mockResolvedValue(['session-123', 'scratch'] as any);
    vi.spyOn(fs, 'stat').mockResolvedValue({
      isDirectory: () => true,
      mtime: new Date('2026-07-11T12:00:00.000Z')
    } as any);

    const handler = (SessionsRoute.options.server?.handlers as any)?.GET;
    expect(handler).toBeDefined();

    const response = await handler!({ request: new Request('http://localhost/api/sessions') });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.sessions).toBeDefined();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].sessionId).toBe('session-123');
  });

  it('should handle remote turn spawn and execution', async () => {
    const handler = (ChatRoute.options.server?.handlers as any)?.POST;
    expect(handler).toBeDefined();

    // Mock spawn in agent-manager to avoid launching a subprocess
    const spyStart = vi.spyOn(await import('./agent-manager'), 'startAgentSession')
      .mockImplementation(async () => {
        // no-op: avoid launching a real subprocess in this test
      });

    const mockRequest = new Request('http://localhost/api/sessions/session-abc/chat', {
      method: 'POST',
      body: JSON.stringify({
        directory: '/Users/rainforest/Repositories/cool-proj',
        prompt: 'test code execution'
      })
    });

    const response = await handler!({ 
      params: { sessionId: 'session-abc' },
      request: mockRequest 
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(spyStart).toHaveBeenCalledWith(
      'session-abc',
      '/Users/rainforest/Repositories/cool-proj',
      'test code execution'
    );
  });

  it('should process user tool approval decisions', async () => {
    const handler = (ApproveRoute.options.server?.handlers as any)?.POST;
    expect(handler).toBeDefined();

    const session = getOrCreateSession('session-xyz');
    let approvedVal = false;
    session.pendingResolve = (val) => {
      approvedVal = val;
    };

    const mockRequest = new Request('http://localhost/api/sessions/session-xyz/approve', {
      method: 'POST',
      body: JSON.stringify({ decision: true })
    });

    const response = await handler!({
      params: { sessionId: 'session-xyz' },
      request: mockRequest
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(approvedVal).toBe(true);
  });
});
