import { READ_ONLY_NOTE } from './registry.types.js';

/**
 * Turns a failed registry write into the reason the caller can act on.
 *
 * Classifying the error the write itself raised beats probing beforehand: the
 * probe cannot tell a missing file from a read-only mount, and a vault
 * remounted between the probe and the write slips through it either way.
 */
export function writeErrorResponse(err: unknown, path: string): Response {
  const code = (err as NodeJS.ErrnoException | null)?.code;

  if (code === 'EROFS' || code === 'EACCES' || code === 'EPERM')
    return Response.json(
      { error: READ_ONLY_NOTE, writable: false },
      { status: 409 },
    );

  if (code === 'ENOENT')
    return Response.json(
      { error: `No registry file at ${path} — check VAULT_PATH.` },
      { status: 404 },
    );

  return Response.json({ error: String(err) }, { status: 500 });
}
