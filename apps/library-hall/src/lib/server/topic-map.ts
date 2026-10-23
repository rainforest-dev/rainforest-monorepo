import { readFile, stat } from 'node:fs/promises';

import { parseTopicMap, type TopicMap } from '@rainforest-dev/library-contract';

let cached: { path: string; mtimeMs: number; map: TopicMap } | null = null;
let warned: string | null = null;

/**
 * The vault's topic map, from the file `LIBRARY_TOPIC_MAP` names. It is read again only when the
 * file changes, so an edit in Obsidian shows on the next load of the hall. Without the variable,
 * or when the file cannot be read, the map is empty and every tag stays its own topic.
 */
export async function loadTopicMap(
  env: Record<string, string | undefined> = process.env,
): Promise<TopicMap> {
  const path = env['LIBRARY_TOPIC_MAP']?.trim();
  if (!path) return new Map();
  try {
    const { mtimeMs } = await stat(path);
    if (cached?.path === path && cached.mtimeMs === mtimeMs) return cached.map;
    const map = parseTopicMap(await readFile(path, 'utf8'));
    cached = { path, mtimeMs, map };
    warned = null;
    return map;
  } catch (error) {
    if (warned !== path) {
      warned = path;
      console.warn(
        `[hall] topic map ${path} could not be read; topics stay as each collection names them: ${String(error)}`,
      );
    }
    return new Map();
  }
}
