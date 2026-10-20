/**
 * Notebooks moved to personal-notebook. What calibre keeps of them is a pass-through for the
 * inbox automation, until it points at the new app; next.config redirects old links.
 */

const trimmed = (value: string | undefined) =>
  value?.trim().replace(/\/+$/, '') || null;

const FORWARDED_HEADERS = ['content-type', 'content-length', 'x-inbox-secret'];

/**
 * Sends a request on to personal-notebook at `path` under `NOTEBOOK_INTERNAL_URL`, body
 * streamed, and returns its answer. The notebook app checks the inbox secret itself. Null while
 * `NOTEBOOK_INTERNAL_URL` is unset.
 */
export async function forwardToNotebook(
  request: Request,
  path: string,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Response | null> {
  const base = trimmed(env['NOTEBOOK_INTERNAL_URL']);
  if (!base) return null;
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const response = await fetchImpl(`${base}${path}`, {
    method: request.method,
    headers,
    body: request.body,
    // Required by undici to stream a request body.
    duplex: 'half',
  } as RequestInit);
  return new Response(response.body, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? '' },
  });
}
