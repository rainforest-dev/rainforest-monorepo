import { READ_ONLY_NOTE } from '@/lib';

import {
  duplicateNameWarnings,
  isWritable,
  parseSources,
  parseTopics,
  registryFilePath,
  SOURCES_FILE,
  TOPICS_FILE,
} from './registry.js';
import {
  editRegistryFile,
  type EditResult,
  editSources,
  editTopics,
  SOURCE_ACTIONS,
  TOPIC_ACTIONS,
} from './registryEdit.js';

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

type PatchTarget<A extends string> = {
  filename: string;
  listKey: 'sources' | 'topics';
  actions: readonly A[];
  edit: (text: string, names: string[], action: A) => EditResult;
  parse: (text: string) => { name: string }[];
};

export const SOURCES_PATCH: PatchTarget<(typeof SOURCE_ACTIONS)[number]> = {
  filename: SOURCES_FILE,
  listKey: 'sources',
  actions: SOURCE_ACTIONS,
  edit: editSources,
  parse: parseSources,
};

export const TOPICS_PATCH: PatchTarget<(typeof TOPIC_ACTIONS)[number]> = {
  filename: TOPICS_FILE,
  listKey: 'topics',
  actions: TOPIC_ACTIONS,
  edit: editTopics,
  parse: parseTopics,
};

function requestedNames(body: {
  name?: unknown;
  names?: unknown;
}): string[] | undefined {
  if (body.names === undefined)
    return typeof body.name === 'string' && body.name ? [body.name] : undefined;

  const { names } = body;
  return Array.isArray(names) &&
    names.length > 0 &&
    names.every((n) => typeof n === 'string' && n)
    ? (names as string[])
    : undefined;
}

export async function handleRegistryPatch<A extends string>(
  request: Request,
  target: PatchTarget<A>,
): Promise<Response> {
  const body = ((await request.json().catch(() => null)) ?? {}) as {
    name?: unknown;
    names?: unknown;
    action?: unknown;
  };
  const names = requestedNames(body);
  const { action } = body;

  if (!names || typeof action !== 'string' || !action)
    return Response.json(
      { error: 'Missing name, names or action' },
      { status: 400 },
    );
  if (!(target.actions as readonly string[]).includes(action))
    return Response.json(
      { error: `Unknown action: ${action}` },
      { status: 400 },
    );

  const path = registryFilePath(target.filename);
  try {
    const result = editRegistryFile(path, (text) =>
      target.edit(text, names, action as A),
    );

    if (!result.ok)
      return Response.json(
        {
          error: `Nothing was written: ${result.rejected
            .map(({ name, reason }) => `${name} (${reason})`)
            .join('; ')}.`,
          rejected: result.rejected,
        },
        { status: 409 },
      );

    const items = target.parse(result.text);
    return Response.json({
      ok: true,
      applied: result.applied,
      [target.listKey]: items,
      writable: isWritable(target.filename),
      warnings: duplicateNameWarnings(items),
    });
  } catch (err) {
    return writeErrorResponse(err, path);
  }
}
