/**
 * Fires a single GA4 event via the Measurement Protocol, server-side.
 *
 * Cookieless by design: GA4 requires a `client_id`, but we mint a fresh random
 * one per event (we count events, not stitch users), so nothing is stored on the
 * visitor and no consent banner is required. Keeping `GA_API_SECRET` server-side
 * also means the browser never sees it.
 *
 * Requires `GA_MEASUREMENT_ID` + `GA_API_SECRET` (Vercel → Environment Variables).
 * No-ops when unset, and swallows its own errors — analytics must never turn into
 * a broken response for the caller.
 */
export async function sendGa4Event(
  name: string,
  params: Record<string, string | number> = {},
  clientId: string = crypto.randomUUID(),
): Promise<void> {
  const measurementId = process.env.GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA_API_SECRET;
  if (!measurementId || !apiSecret) return;

  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, events: [{ name, params }] }),
      },
    );
  } catch {
    // Best-effort only.
  }
}
