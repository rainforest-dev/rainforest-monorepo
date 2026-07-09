import { track } from '@vercel/analytics/server';

// Coarse bot classification, not an exhaustive list — good enough to answer "are AI
// crawlers actually hitting these endpoints", which is the question this exists to answer.
// Extend as new agents show up in real traffic rather than trying to enumerate every one
// up front.
const AI_BOT_PATTERNS: [name: string, pattern: RegExp][] = [
  ['GPTBot', /GPTBot/i],
  ['ClaudeBot', /ClaudeBot|Claude-User|anthropic-ai/i],
  ['PerplexityBot', /PerplexityBot|Perplexity-User/i],
  ['Google-Extended', /Google-Extended/i],
  ['CCBot', /CCBot/i],
  ['Bytespider', /Bytespider/i],
];

function classifyUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'unknown';
  const match = AI_BOT_PATTERNS.find(([, pattern]) => pattern.test(userAgent));
  return match ? match[0] : 'other';
}

/**
 * Fires a Vercel Analytics custom event for a hit on one of the AI-facing resources
 * (llms.txt, llms-full.txt, the MCP server) — these are the endpoints this whole feature
 * set exists to measure the effect of, so "did anything real request them, and was it an
 * AI crawler" is the question worth tracking, not raw pageviews. Swallows its own errors:
 * a failed analytics call must never turn into a broken response for the actual resource.
 * Server-only (imports @vercel/analytics/server) — import this by its exact path from API
 * routes, not via the shared @utils barrel, which client-hydrated components also pull from.
 */
export async function trackAiResourceFetch(resource: string, request: Request): Promise<void> {
  try {
    await track('ai_resource_fetch', {
      resource,
      bot: classifyUserAgent(request.headers.get('user-agent')),
    });
  } catch {
    // Best-effort only.
  }
}
