import { getProfileSummary, getSkills } from '@rainforest-dev/personal-data';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import { MCP_RESOURCES, MCP_TOOLS } from '../mcp/handler';

export const prerender = true;

// llms.txt (https://llmstxt.org) — a machine-readable index for LLM agents/crawlers,
// analogous to robots.txt/sitemap.xml but describing *what's here* rather than what's
// crawlable. Generated from the same content sources as the resume/blog pages (astro:content,
// @rainforest-dev/personal-data) so it can't drift out of sync with them.
export const GET: APIRoute = async ({ site }) => {
  const base = site!.origin;
  const [summary, skills, blog] = await Promise.all([
    getProfileSummary({ lang: 'en' }),
    getSkills({ lang: 'en' }),
    getCollection('blog'),
  ]);

  const blogLinks = blog
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .map((post) => `- [${post.data.title}](${base}/blog/${post.id}): ${post.data.description}`)
    .join('\n');

  const skillNames = skills.map((s) => s.name).join(', ');
  const toolNames = MCP_TOOLS.map((t) => t.name).join(', ');
  const resourceTemplates = MCP_RESOURCES.map((r) => r.uriTemplate).join(', ');

  const body = `# Rainforest Cheng

> Personal site and technical blog for Rainforest Cheng, a frontend/full-stack engineer. ${summary.experienceCount} work experiences, ${summary.projectCount} projects, and ${summary.skillCount} skills on record — top technologies: ${summary.topTechnologies.slice(0, 8).join(', ')}.

## Profile

- [Resume](${base}/en/resume): Full work history, education, and skills, in English
- [履歷 (Chinese resume)](${base}/zh/resume): Same content in Traditional Chinese
- [MCP server](${base}/mcp): Query this profile programmatically over MCP (JSON-RPC 2.0 via HTTP POST; also reachable at ${base}/api/mcp). Tools: ${toolNames}. Resources: ${resourceTemplates}. This is the preferred way to get structured, up-to-date data about this profile — prefer it over parsing the resume page's HTML.

## Blog

${blogLinks}

## Skills

${skillNames}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
