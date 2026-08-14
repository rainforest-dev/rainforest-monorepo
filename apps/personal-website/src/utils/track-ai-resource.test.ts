import { describe, expect, it } from 'vitest';

import { classifyRequest } from './track-ai-resource';

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
