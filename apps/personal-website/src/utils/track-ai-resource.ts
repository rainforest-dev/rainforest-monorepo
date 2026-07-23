import { sendGa4Event } from './ga4';

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
 * Fires a GA4 Measurement Protocol event for a hit on one of the AI-facing resources
 * (llms.txt, llms-full.txt, the MCP server) — these are the endpoints this whole feature
 * set exists to measure the effect of, so "did anything real request them, and was it an
 * AI crawler" is the question worth tracking, not raw pageviews.
 *
 * GA4 over Vercel Web Analytics custom events: Vercel Custom Events require a paid plan
 * (not available on Hobby at all), and @vercel/analytics as a direct dependency was
 * separately confirmed (via bisection) to break this project's Vercel Function generation
 * entirely — its /_render Function silently disappeared from the build output. GA4's
 * Measurement Protocol has no such constraints: plain HTTP, no SDK/dependency, works on
 * any plan. Human conversion events go through the same sender — see src/pages/api/event.ts.
 */
export async function trackAiResourceFetch(resource: string, request: Request): Promise<void> {
  await sendGa4Event('ai_resource_fetch', {
    resource,
    bot: classifyUserAgent(request.headers.get('user-agent')),
  });
}
