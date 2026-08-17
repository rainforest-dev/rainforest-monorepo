import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendGa4Event } from './ga4';
import { classifyRequest, trackMcpFetch } from './track-ai-resource';

vi.mock('./ga4', () => ({ sendGa4Event: vi.fn() }));

const CLAUDE_UA =
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com';

const request = (url: string, userAgent?: string) =>
  new Request(url, userAgent ? { headers: { 'user-agent': userAgent } } : {});

describe('classifyRequest', () => {
  it('buckets a marked request as self', () => {
    expect(
      classifyRequest(request('https://rainforest.tools/api/mcp?src=self')),
    ).toBe('self');
  });

  // The motivating case. Own MCP traffic arrives *as* ClaudeBot, so a UA-first
  // classifier would swallow the marker and keep reporting own usage as discovery —
  // which is exactly how 569 of one month's 722 fetches came to look like exposure.
  it('prefers the self marker over a ClaudeBot user-agent', () => {
    expect(
      classifyRequest(
        request('https://rainforest.tools/api/mcp?src=self', CLAUDE_UA),
      ),
    ).toBe('self');
  });

  it('still classifies ClaudeBot when the marker is absent', () => {
    expect(
      classifyRequest(request('https://rainforest.tools/api/mcp', CLAUDE_UA)),
    ).toBe('ClaudeBot');
  });

  it('ignores a src param that is not the marker', () => {
    expect(
      classifyRequest(
        request('https://rainforest.tools/api/mcp?src=linkedin', CLAUDE_UA),
      ),
    ).toBe('ClaudeBot');
  });

  it('names other known agents', () => {
    expect(
      classifyRequest(request('https://rainforest.tools/llms.txt', 'GPTBot/1.2')),
    ).toBe('GPTBot');
  });

  it('falls back to other for an unrecognised agent', () => {
    expect(
      classifyRequest(request('https://rainforest.tools/llms.txt', 'curl/8.4.0')),
    ).toBe('other');
  });

  it('falls back to unknown when no user-agent is sent', () => {
    expect(classifyRequest(request('https://rainforest.tools/llms.txt'))).toBe(
      'unknown',
    );
  });
});

const mcpRequest = (body: unknown, init: RequestInit = {}) =>
  new Request('https://rainforest.tools/mcp', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  });

const paramsFor = async (req: Request) => {
  await trackMcpFetch(req);
  return vi.mocked(sendGa4Event).mock.calls.at(-1)?.[1];
};

describe('trackMcpFetch', () => {
  beforeEach(() => {
    vi.mocked(sendGa4Event).mockClear();
  });

  // The reason this exists: one client connecting runs initialize →
  // notifications/initialized → tools/list before it asks anything, so a single
  // connection lands as ~4 events. Undifferentiated, that reads as 4x the reach.
  it('tells a handshake step apart from a real query', async () => {
    expect((await paramsFor(mcpRequest({ method: 'initialize' })))?.mcp_method).toBe(
      'initialize',
    );
    expect((await paramsFor(mcpRequest({ method: 'tools/call' })))?.mcp_method).toBe(
      'tools/call',
    );
  });

  it('collapses an unlisted method to other', async () => {
    expect(
      (await paramsFor(mcpRequest({ method: 'anything/at/all' })))?.mcp_method,
    ).toBe('other');
  });

  it('reports a JSON-RPC batch as batch', async () => {
    expect(
      (await paramsFor(mcpRequest([{ method: 'tools/list' }])))?.mcp_method,
    ).toBe('batch');
  });

  it('falls back to unknown on a malformed body', async () => {
    expect((await paramsFor(mcpRequest('not json')))?.mcp_method).toBe('unknown');
  });

  it('still classifies the caller', async () => {
    expect(
      (
        await paramsFor(
          mcpRequest(
            { method: 'initialize' },
            { headers: { 'user-agent': CLAUDE_UA } },
          ),
        )
      )?.bot,
    ).toBe('ClaudeBot');
  });

  // The one failure mode that stays invisible in GA4 while breaking production
  // outright: reading the body without cloning hands the MCP handler an empty stream.
  it('leaves the body readable for the handler', async () => {
    const req = mcpRequest({ method: 'tools/call', id: 7 });
    await trackMcpFetch(req);
    await expect(req.json()).resolves.toMatchObject({ id: 7 });
  });
});
