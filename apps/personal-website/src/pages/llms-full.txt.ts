import {
  getEducation,
  getProfileSummary,
  getProjects,
  getSkills,
  getWorkExperience,
  type ResolvedExperience,
} from '@rainforest-dev/personal-data';
import { listCaseStudies } from '@rainforest-dev/portfolio/content';
import { trackAiResourceFetch } from '@utils/track-ai-resource';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// Not prerendered — see llms.txt.ts's comment for why: a prerendered handler only runs
// once, at build time, so it can't fire trackAiResourceFetch per real visitor.

const formatMonth = (d: Date) => d.toISOString().slice(0, 7);

function formatExperience(e: ResolvedExperience): string {
  const range = `${formatMonth(e.startAt)} – ${e.endAt ? formatMonth(e.endAt) : 'present'}`;
  const tech = e.technologies.length ? `\nTechnologies: ${e.technologies.join(', ')}` : '';
  return `### ${e.position} — ${e.organization.name}\n${range}${tech}\n\n${e.content}`;
}

// llms-full.txt — the expanded companion to llms.txt (https://llmstxt.org): full resume
// content inlined rather than just links, for agents that want everything in one fetch
// instead of following each link individually. Same data sources as llms.txt and the
// resume page (@rainforest-dev/personal-data, astro:content), so it can't drift out of
// sync with them. Blog posts stay a link list here (not inlined) — they're independently
// crawlable full HTML pages already, and inlining varied-length MDX bodies would bloat
// this file without adding anything the profile-focused sections above don't already cover.
export const GET: APIRoute = async ({ site, request }) => {
  await trackAiResourceFetch('llms-full.txt', request);
  const base = site!.origin;
  const [summary, experiences, education, projects, skills, blog] = await Promise.all([
    getProfileSummary({ lang: 'en' }),
    getWorkExperience({ lang: 'en' }),
    getEducation({ lang: 'en' }),
    getProjects({ lang: 'en' }),
    getSkills({ lang: 'en' }),
    getCollection('blog'),
  ]);

  const experienceText = experiences.map(formatExperience).join('\n\n');
  const educationText = education.map(formatExperience).join('\n\n');

  const projectsText = projects
    .map(
      (p) =>
        `### ${p.name} — ${p.organization.name}\nTechnologies: ${p.technologies.join(', ')}\n\n${p.content}`,
    )
    .join('\n\n');

  const skillsText = skills
    .map(
      (s) =>
        `### ${s.name}${s.tags.length ? ` (${s.tags.join(', ')})` : ''}\n\n${s.content || '(no additional detail on record)'}`,
    )
    .join('\n\n');

  const blogLinks = blog
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .map((post) => `- [${post.data.title}](${base}/blog/${post.id}): ${post.data.description}`)
    .join('\n');

  const caseStudyLinks = listCaseStudies()
    .map((cs) => `- [${cs.title}](${base}/en/portfolio/${cs.slug}): ${cs.tagline}`)
    .join('\n');

  const body = `# Rainforest Cheng — Full Profile

> ${summary.experienceCount} work experiences, ${summary.projectCount} projects, ${summary.skillCount} skills. This is the expanded companion to ${base}/llms.txt — the full resume content inlined below, rather than links out. For structured, queryable access to this same data (filter by technology, fetch a single entry, etc.) use the MCP server at ${base}/mcp instead of re-parsing this text.

## Work Experience

${experienceText}

## Education

${educationText}

## Projects

${projectsText}

## Skills

${skillsText}

## Case studies

${caseStudyLinks}

## Blog

${blogLinks}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
