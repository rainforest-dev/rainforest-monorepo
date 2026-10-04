import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const STATE_FILE = '.ingest-state.json';

export type IngestState = { fingerprint: string; completedAt: string };

const listFiles = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => join(entry.parentPath, entry.name))
    : [];

export function inputFingerprint(root: string): string {
  const files = [
    ...listFiles(join(root, 'line')),
    ...listFiles(join(root, 'slack')),
    join(root, 'photos', 'index.json'),
    join(root, 'people.json'),
  ].filter((path) => existsSync(path));
  const lines = files
    .map((path) => {
      const { size, mtimeMs } = statSync(path);
      return `${relative(root, path)}\t${size}\t${mtimeMs}`;
    })
    .sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

export function readIngestState(root: string): IngestState | undefined {
  try {
    const state = JSON.parse(
      readFileSync(join(root, STATE_FILE), 'utf8'),
    ) as Partial<IngestState>;
    return typeof state.fingerprint === 'string' &&
      typeof state.completedAt === 'string'
      ? { fingerprint: state.fingerprint, completedAt: state.completedAt }
      : undefined;
  } catch {
    return undefined;
  }
}
