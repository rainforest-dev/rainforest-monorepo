/**
 * The one PATCH both islands make. Kept here so a fix to how a failure is read
 * lands on sources and topics at once.
 */

export type PatchResult =
  { ok: true } | { ok: false; error: string; readOnly: boolean };

export async function patchRegistry(
  endpoint: string,
  name: string,
  action: string,
): Promise<PatchResult> {
  const res = await fetch(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, action }),
  });

  // Success is read from the body, not the status: an auth proxy answers a
  // redirected PATCH with its own 200 page, which would otherwise register as
  // a write that landed.
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    writable?: boolean;
  } | null;

  if (body?.ok) return { ok: true };

  if (!body)
    return {
      ok: false,
      readOnly: false,
      error: res.ok
        ? 'The server answered with a page instead of JSON — the session has probably expired. Reload and try again.'
        : `The server answered ${res.status}.`,
    };

  return {
    ok: false,
    readOnly: body.writable === false,
    error: body.error ?? `The server answered ${res.status}.`,
  };
}
