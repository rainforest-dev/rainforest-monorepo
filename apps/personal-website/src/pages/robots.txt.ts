import type { APIRoute } from 'astro';

// Explicitly welcome everyone, including AI crawlers (GPTBot, ClaudeBot, …), and
// point both classic crawlers (Sitemap) and agents (llms.txt) at their entry points.
const getRobotsTxt = (site: URL) => `
User-agent: *
Allow: /

Sitemap: ${new URL('/sitemap-index.xml', site).href}

# AI-readable summaries for agents:
# ${new URL('/llms.txt', site).href}
# ${new URL('/llms-full.txt', site).href}
`;

export const GET: APIRoute = ({ site }) => {
  return new Response(getRobotsTxt(site!));
};
