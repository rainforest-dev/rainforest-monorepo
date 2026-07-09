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
 * any plan.
 *
 * Requires GA_MEASUREMENT_ID and GA_API_SECRET env vars (Vercel dashboard → Settings →
 * Environment Variables — see GA4 Admin → Data Streams → your stream → Measurement
 * Protocol API secrets → Create). Silently no-ops if either is unset, so this is safe to
 * deploy before they're configured. Swallows its own errors: a failed analytics call must
 * never turn into a broken response for the actual resource being served.
 */
export async function trackAiResourceFetch(resource: string, request: Request): Promise<void> {
  const measurementId = process.env.GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA_API_SECRET;
  if (!measurementId || !apiSecret) return;

  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          // GA4 requires a client_id; there's no real client/session for server-to-server
          // bot traffic, so a fresh one per event is fine — nothing here needs cross-request
          // identity, just per-hit counts and properties.
          client_id: crypto.randomUUID(),
          events: [
            {
              name: 'ai_resource_fetch',
              params: { resource, bot: classifyUserAgent(request.headers.get('user-agent')) },
            },
          ],
        }),
      },
    );
  } catch {
    // Best-effort only.
  }
}
