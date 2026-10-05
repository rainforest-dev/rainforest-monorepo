export type Rejection = { name: string; reason: string };

export type PatchResult<T> =
  | {
      ok: true;
      applied: string[];
      items: T[];
      writable: boolean;
      warnings: string[];
    }
  | { ok: false; error: string; readOnly: boolean; rejected: Rejection[] };

type PatchBody = {
  ok?: boolean;
  error?: string;
  writable?: boolean;
  applied?: string[];
  sources?: unknown[];
  topics?: unknown[];
  warnings?: string[];
  rejected?: Rejection[];
};

export async function patchRegistry<T>(
  endpoint: string,
  names: string[],
  action: string,
): Promise<PatchResult<T>> {
  const res = await fetch(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ names, action }),
  });

  // Success is read from the body, not the status: an auth proxy answers a
  // redirected PATCH with its own 200 page, which would otherwise register as
  // a write that landed.
  const body = (await res.json().catch(() => null)) as PatchBody | null;

  if (body?.ok)
    return {
      ok: true,
      applied: body.applied ?? [],
      items: (body.sources ?? body.topics ?? []) as T[],
      writable: body.writable !== false,
      warnings: body.warnings ?? [],
    };

  if (!body)
    return {
      ok: false,
      readOnly: false,
      rejected: [],
      error: res.ok
        ? 'The server answered with a page instead of JSON — the session has probably expired. Reload and try again.'
        : `The server answered ${res.status}.`,
    };

  return {
    ok: false,
    readOnly: body.writable === false,
    error: body.error ?? `The server answered ${res.status}.`,
    rejected: body.rejected ?? [],
  };
}
