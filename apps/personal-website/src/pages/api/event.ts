import { sendGa4Event } from '@utils/ga4';
import type { APIRoute } from 'astro';

// On-demand: this is the cookieless conversion-event sink. The browser (see
// src/scripts/conversion-tracking.ts) POSTs recruiter-relevant interactions here
// and we forward them to GA4 server-side, so GA_API_SECRET stays private and no
// GA cookie is ever set on the visitor.
export const prerender = false;

// Allowlist of accepted events → their permitted param keys. Anything else is
// rejected, so this public endpoint can't be abused to inject arbitrary GA4 data.
const ALLOWED: Record<string, readonly string[]> = {
  outbound_click: ['target'], // github | linkedin | email
  contact_submit: [],
  resume_view: [],
  case_study_view: ['slug'],
};

export const POST: APIRoute = async ({ request }) => {
  // Same-origin guard: reduces casual spam without being a hard security boundary.
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host && new URL(origin).host !== host) {
    return new Response(null, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const { event, params } = (body ?? {}) as {
    event?: string;
    params?: Record<string, unknown>;
  };
  if (!event || !(event in ALLOWED)) return new Response(null, { status: 400 });

  // Keep only allowlisted string params, length-capped.
  const clean: Record<string, string> = {};
  for (const key of ALLOWED[event]) {
    const value = params?.[key];
    if (typeof value === 'string' && value) clean[key] = value.slice(0, 100);
  }

  await sendGa4Event(event, clean);
  return new Response(null, { status: 204 });
};
