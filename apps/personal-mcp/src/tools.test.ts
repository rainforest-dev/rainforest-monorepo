import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';

import { registerTools } from './tools';

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerTools(server);
  // Reaching into McpServer internals: in the installed SDK (1.29.0) registered tools
  // live on `_registeredTools` directly on McpServer (not nested under `.server`), and
  // the stored callback is named `handler`.
  const result = await (
    server as unknown as {
      _registeredTools: Record<string, { handler: (args: unknown, extra: unknown) => Promise<unknown> }>;
    }
  )._registeredTools[name].handler(args, {});
  return result as { content: Array<{ type: string; text: string }> };
}

describe('registerTools', () => {
  it('get_profile_summary returns counts and top technologies', async () => {
    const result = await callTool('get_profile_summary', { lang: 'en' });
    const summary = JSON.parse(result.content[0].text);
    expect(summary.experienceCount).toBeGreaterThan(0);
  });

  it('get_work_experience filters by technology', async () => {
    const result = await callTool('get_work_experience', { technology: 'auth0', lang: 'en' });
    const jobs = JSON.parse(result.content[0].text);
    expect(jobs.some((j: { id: string }) => j.id === 'en/6')).toBe(true);
  });

  it('get_education returns entries', async () => {
    const result = await callTool('get_education', { lang: 'en' });
    const education = JSON.parse(result.content[0].text);
    expect(Array.isArray(education)).toBe(true);
  });

  it('get_projects filters by technology', async () => {
    const result = await callTool('get_projects', { technology: 'nextjs', lang: 'en' });
    const projects = JSON.parse(result.content[0].text);
    expect(projects.some((p: { id: string }) => p.id === 'en/opencgt')).toBe(true);
  });

  it('get_skills returns entries', async () => {
    const result = await callTool('get_skills', { lang: 'en' });
    const skills = JSON.parse(result.content[0].text);
    expect(skills.some((s: { id: string }) => s.id === 'en/ts')).toBe(true);
  });

  it('search_by_technology matches across experiences and projects', async () => {
    const result = await callTool('search_by_technology', { query: 'next', lang: 'en' });
    const { projects } = JSON.parse(result.content[0].text);
    expect(projects.some((p: { id: string }) => p.id === 'en/opencgt')).toBe(true);
  });
});
