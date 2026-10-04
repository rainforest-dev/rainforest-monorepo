import { readFile, stat } from 'node:fs/promises';

export type CachedFile<T> = { get: () => Promise<T> };

type Options = {
  checkEveryMs?: number;
  log?: (message: string) => void;
};

const MISSING = 'missing';

async function signature(path: string): Promise<string> {
  try {
    const stats = await stat(path);
    return `${stats.mtimeMs}:${stats.size}`;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return MISSING;
    throw error;
  }
}

export function cachedFile<T>(
  path: string | undefined,
  load: (contents: string | undefined) => T,
  { checkEveryMs = 5000, log = console.error }: Options = {},
): CachedFile<T> {
  let current: { value: T } | undefined;
  let failure: unknown;
  let seen: string | undefined;
  let checkedAt = -Infinity;
  let inflight: Promise<T> | undefined;

  const valueOrFailure = (): T => {
    if (current) return current.value;
    throw failure;
  };

  async function refresh(): Promise<T> {
    checkedAt = Date.now();
    let sig: string;
    try {
      sig = path ? await signature(path) : MISSING;
    } catch (error) {
      if (!current) throw error;
      log(`[memories] cannot stat ${path}: ${String(error)}`);
      return current.value;
    }
    if (sig === seen) return valueOrFailure();
    seen = sig;
    try {
      const contents =
        path && sig !== MISSING ? await readFile(path, 'utf8') : undefined;
      current = { value: load(contents) };
      failure = undefined;
    } catch (error) {
      failure = error;
      log(
        `[memories] ${path} is unreadable${current ? ', keeping the previous copy' : ''}: ${String(error)}`,
      );
    }
    return valueOrFailure();
  }

  return {
    get() {
      if (inflight) return inflight;
      if (Date.now() - checkedAt < checkEveryMs && (current || seen))
        return Promise.resolve().then(valueOrFailure);
      inflight = refresh().finally(() => {
        inflight = undefined;
      });
      return inflight;
    },
  };
}
