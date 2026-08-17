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

// Own-usage marker. The site owner's `rainforest-profile` connector points at
// `/api/mcp?src=self`, so its traffic lands in its own bucket instead of inflating the
// discovery numbers — it arrives with a ClaudeBot user-agent and is otherwise
// indistinguishable from a stranger's agent finding the endpoint.
const SELF_TRAFFIC_PARAM = 'src';
const SELF_TRAFFIC_VALUE = 'self';

/**
 * Which bucket a request belongs to. The self marker deliberately takes precedence over
 * the user-agent: own traffic *is* ClaudeBot, so classifying by UA first would make the
 * marker unreachable.
 *
 * Self traffic is tagged rather than dropped — the event still tells you the endpoint
 * works, and a tag can be filtered out in a report whereas a dropped event is gone. It
 * reuses the existing `bot` param (and so the existing `AI Bot` custom dimension) because
 * GA4 custom dimensions are not retroactive: a new param would report `(not set)` for
 * everything already collected.
 */
export function classifyRequest(request: Request): string {
  const { searchParams } = new URL(request.url);
  if (searchParams.get(SELF_TRAFFIC_PARAM) === SELF_TRAFFIC_VALUE) {
    return SELF_TRAFFIC_VALUE;
  }
  return classifyUserAgent(request.headers.get('user-agent'));
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
export async function trackAiResourceFetch(
  resource: string,
  request: Request,
): Promise<void> {
  await sendGa4Event('ai_resource_fetch', {
    resource,
    bot: classifyRequest(request),
  });
}

// JSON-RPC methods reported as themselves. Anything else collapses to `other`, so a
// caller can't inflate GA4's dimension cardinality with arbitrary strings — the same
// allowlist posture as api/event.ts.
const MCP_METHODS = new Set([
  'initialize',
  'notifications/initialized',
  'tools/list',
  'tools/call',
  'prompts/list',
  'resources/list',
  'ping',
]);

async function readMcpMethod(request: Request): Promise<string> {
  try {
    // clone() first: a Request body is a single-use stream, and the MCP handler still
    // has to read it. Reading it here directly would hand the handler an empty body.
    const body: unknown = await request.clone().json();
    // JSON-RPC permits a batch as an array, which has no single method.
    if (Array.isArray(body)) return 'batch';
    const method = (body as { method?: unknown } | null)?.method;
    if (typeof method !== 'string') return 'unknown';
    return MCP_METHODS.has(method) ? method : 'other';
  } catch {
    return 'unknown';
  }
}

/**
 * The MCP-route flavour of {@link trackAiResourceFetch}, additionally recording which
 * JSON-RPC method was called.
 *
 * Without it the event count badly overstates reach: one client connecting runs
 * `initialize` → `notifications/initialized` → `tools/list` before it has asked a single
 * question, so a single connection lands as ~4 fetches. Splitting by method separates
 * "someone connected" from "someone actually queried the profile", which is the only one
 * of the two that means anything for exposure.
 */
export async function trackMcpFetch(request: Request): Promise<void> {
  await sendGa4Event('ai_resource_fetch', {
    resource: 'mcp',
    bot: classifyRequest(request),
    mcp_method: await readMcpMethod(request),
  });
}
