// @vitest-environment node
//
// This file (via handler.ts -> profile.ts) statically imports the `astro:content` virtual
// module, which Astro's content-collection Vite plugin refuses to resolve in a "client" Vite
// environment (jsdom/happy-dom) — see https://github.com/withastro/astro/issues/14895. The
// project default is jsdom (src/utils/ai/ needs sessionStorage); this file overrides to node,
// which Astro treats as server-side, so astro:content resolves.
import { describe, expect, it } from 'vitest';

import { PROFILE_TOOLS, toToolDescriptors } from './catalog';
import { MCP_TOOLS } from './handler';

/**
 * Characterisation, not specification: this records what the live server at
 * rainforest.tools/mcp advertises TODAY, so the catalog refactor in Tasks 2–3 is provably
 * behaviour-preserving. A remote MCP client breaking is invisible from the site itself, so
 * "it still looks fine" is not evidence.
 *
 * If a change to this list is intended, update it deliberately — do not "fix" it to make a
 * refactor pass.
 */
describe('MCP tool surface (characterisation)', () => {
  it('advertises exactly these tools', () => {
    expect(MCP_TOOLS.map((t) => t.name).sort()).toEqual([
      'get_case_study',
      'get_education',
      'get_profile_summary',
      'get_projects',
      'get_skills',
      'get_work_experience',
      'search_by_technology',
    ]);
  });

  it('keeps get_case_study, which comes from the portfolio library, not profile.ts', () => {
    expect(MCP_TOOLS.find((t) => t.name === 'get_case_study')).toBeDefined();
  });

  it('gives every tool a non-empty description', () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });
});

describe('toToolDescriptors', () => {
  it('derives JSON Schema from the Zod params', () => {
    const descriptors = toToolDescriptors();
    const search = descriptors.find((d) => d.name === 'search_by_technology');
    expect(search?.inputSchema).toMatchObject({
      type: 'object',
      properties: { query: { type: 'string' } },
    });
  });

  it('exposes every catalog tool', () => {
    expect(
      toToolDescriptors()
        .map((d) => d.name)
        .sort(),
    ).toEqual(PROFILE_TOOLS.map((t) => t.name).sort());
  });

  // The palette/WebMCP path feeds `execute` arguments an on-device model produced from
  // `inputSchema` as a `responseConstraint` — a model can accept a response schema and still
  // not honour it (this is E0's premise). `execute` must reject before the bad value ever
  // reaches `run`/the data layer, unlike the MCP path, which the SDK's own zod-compat layer
  // already validates.
  it('rejects a model-produced argument that violates params, before reaching run', async () => {
    const descriptors = toToolDescriptors();
    const summary = descriptors.find((d) => d.name === 'get_profile_summary');
    await expect(summary?.execute({ lang: 'fr' })).rejects.toThrow();
  });
});

describe('summarise', () => {
  const find = (name: string) => {
    const tool = PROFILE_TOOLS.find((t) => t.name === name);
    if (!tool) throw new Error(`no such tool: ${name}`);
    return tool;
  };

  it('get_profile_summary', () => {
    const tool = find('get_profile_summary');
    const result = { experienceCount: 5, projectCount: 4 };
    expect(tool.summarise(result as never, { lang: 'en' } as never)).toBe(
      '5 roles and 4 projects on record.',
    );
  });

  it('get_work_experience, filtered by technology', () => {
    const tool = find('get_work_experience');
    const result = [{ id: 'en/1' }, { id: 'en/2' }];
    expect(
      tool.summarise(result as never, { technology: 'react' } as never),
    ).toBe('react appears in 2 roles.');
  });

  it('get_education', () => {
    const tool = find('get_education');
    const result = [{ id: 'en/1' }];
    expect(tool.summarise(result as never, {} as never)).toBe(
      '1 qualification on record.',
    );
  });

  it('get_projects, filtered by technology', () => {
    const tool = find('get_projects');
    const result = [{ id: 'en/1' }, { id: 'en/2' }, { id: 'en/3' }];
    expect(
      tool.summarise(result as never, { technology: 'vue' } as never),
    ).toBe('vue appears in 3 projects.');
  });

  it('get_skills', () => {
    const tool = find('get_skills');
    const result = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];
    expect(tool.summarise(result as never, {} as never)).toBe(
      '4 skills listed.',
    );
  });

  it('search_by_technology, with matches', () => {
    const tool = find('search_by_technology');
    const result = {
      experiences: [{ id: 'en/1' }, { id: 'en/2' }],
      projects: [{ id: 'en/1' }],
    };
    expect(tool.summarise(result as never, { query: 'react' } as never)).toBe(
      'react appears in 2 roles and 1 project.',
    );
  });

  // search_by_technology's zero-match branch — a separate code path from the matches case
  // above, not just a boundary value of it.
  it('search_by_technology, with no matches', () => {
    const tool = find('search_by_technology');
    const result = { experiences: [], projects: [] };
    expect(tool.summarise(result as never, { query: 'cobol' } as never)).toBe(
      'No records mention cobol.',
    );
  });
});
