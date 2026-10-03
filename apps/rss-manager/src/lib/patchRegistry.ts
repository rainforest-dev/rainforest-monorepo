/**
 * The one PATCH both islands make. Kept here so a fix to how a failure is read
 * lands on sources and topics at once.
 */

export type Rejection = { name: string; reason: string };

export type PatchResult =
  { ok: true } | { ok: false; error: string; readOnly: boolean };

export type BatchPatchResult<T> =
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

export function patchRegistry(
  endpoint: string,
  name: string,
  action: string,
): Promise<PatchResult>;
export function patchRegistry<T>(
  endpoint: string,
  names: string[],
  action: string,
): Promise<BatchPatchResult<T>>;
export async function patchRegistry<T>(
  endpoint: string,
  target: string | string[],
  action: string,
): Promise<PatchResult | BatchPatchResult<T>> {
  const batch = Array.isArray(target);
  const res = await fetch(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      batch ? { names: target, action } : { name: target, action },
    ),
  });

  // Success is read from the body, not the status: an auth proxy answers a
  // redirected PATCH with its own 200 page, which would otherwise register as
  // a write that landed.
  const body = (await res.json().catch(() => null)) as PatchBody | null;

  if (body?.ok) {
    if (!batch) return { ok: true };
    return {
      ok: true,
      applied: body.applied ?? [],
      items: (body.sources ?? body.topics ?? []) as T[],
      writable: body.writable !== false,
      warnings: body.warnings ?? [],
    };
  }

  const failure = !body
    ? {
        ok: false as const,
        readOnly: false,
        error: res.ok
          ? 'The server answered with a page instead of JSON — the session has probably expired. Reload and try again.'
          : `The server answered ${res.status}.`,
      }
    : {
        ok: false as const,
        readOnly: body.writable === false,
        error: body.error ?? `The server answered ${res.status}.`,
      };

  return batch ? { ...failure, rejected: body?.rejected ?? [] } : failure;
}
