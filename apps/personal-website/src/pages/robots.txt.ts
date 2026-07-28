import type { APIRoute } from 'astro';

// Fully build-static (no per-request logic, no AI-crawler tracking) — prerender
// it so it ships as a CDN file instead of invoking a serverless function.
export const prerender = true;

// Explicitly welcome everyone, including AI crawlers (GPTBot, ClaudeBot, …), and
// point both classic crawlers (Sitemap) and agents (llms.txt) at their entry points.
const getRobotsTxt = (site: URL) => `
User-agent: *
Allow: /
# POST-only analytics collector — a crawler GET returns 404, which Search Console reports
# as "Blocked due to other 4xx issue". Nothing to index here, so keep crawlers off it.
Disallow: /api/event

Sitemap: ${new URL('/sitemap-index.xml', site).href}

# AI-readable summaries for agents:
# ${new URL('/llms.txt', site).href}
# ${new URL('/llms-full.txt', site).href}
`;

export const GET: APIRoute = ({ site }) => {
  return new Response(getRobotsTxt(site!));
};
