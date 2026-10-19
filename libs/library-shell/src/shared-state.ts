import {
  type CollectionId,
  LIBRARY_CHANNEL,
  type LibraryMessage,
  libraryMessageSchema,
} from '@rainforest-dev/library-contract';

/**
 * State the apps share through same-origin storage: what was opened recently, the last search
 * and where each collection was left. Preferences that SSR needs stay in the prefs cookie.
 */
const PREFIX = 'library:';
const RECENT_LIMIT = 20;

type Area = 'session' | 'local';

function storage(area: Area): Storage | null {
  try {
    return area === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    // Blocked storage (private mode, sandboxed frame) or no window on the server.
    return null;
  }
}

function read<T>(area: Area, key: string, guard: (v: unknown) => v is T) {
  try {
    const raw = storage(area)?.getItem(PREFIX + key);
    if (raw == null) return null;
    const value: unknown = JSON.parse(raw);
    return guard(value) ? value : null;
  } catch {
    return null;
  }
}

function write(area: Area, key: string, value: unknown): void {
  try {
    storage(area)?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota or blocked storage: shared state is a convenience, never required.
  }
}

const isString = (v: unknown): v is string => typeof v === 'string';

/** A same-origin path, never `//host`: a stored value must not become an open redirect. */
const isLocalPath = (v: unknown): v is string =>
  isString(v) && /^\/(?![/\\])/.test(v);

/** Remember where a collection was left, so its tab can return there. Per tab. */
export function rememberReturnPoint(collection: CollectionId, href: string) {
  if (isLocalPath(href)) write('session', `return:${collection}`, href);
}

export function returnPoint(collection: CollectionId): string | null {
  return read('session', `return:${collection}`, isLocalPath);
}

/** The last library-wide search, so it survives a hop to another app. Per tab. */
export function rememberQuery(query: string): void {
  write('session', 'query', query.trim());
}

export function lastQuery(): string | null {
  return read('session', 'query', isString) || null;
}

export interface RecentItem {
  collection: CollectionId;
  id: string;
  title: string;
  href: string;
}

function isRecentList(v: unknown): v is RecentItem[] {
  return (
    Array.isArray(v) &&
    v.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        isString(item.collection) &&
        isString(item.id) &&
        isString(item.title) &&
        isLocalPath(item.href),
    )
  );
}

/** Items opened anywhere in the library, newest first, across tabs and visits. */
export function recentItems(): RecentItem[] {
  return read('local', 'recent', isRecentList) ?? [];
}

export function pushRecent(item: RecentItem): void {
  if (!isLocalPath(item.href)) return;
  const rest = recentItems().filter(
    (r) => !(r.collection === item.collection && r.id === item.id),
  );
  write('local', 'recent', [item, ...rest].slice(0, RECENT_LIMIT));
}

/**
 * Subscribe to cross-tab notices from every app on the hostname. Returns `post` and `close`;
 * both are no-ops where BroadcastChannel is missing.
 */
export function openLibraryChannel(onMessage?: (m: LibraryMessage) => void) {
  if (typeof BroadcastChannel === 'undefined')
    return { post: () => undefined, close: () => undefined };
  const channel = new BroadcastChannel(LIBRARY_CHANNEL);
  if (onMessage)
    channel.onmessage = (event: MessageEvent) => {
      const parsed = libraryMessageSchema.safeParse(event.data);
      if (parsed.success) onMessage(parsed.data);
    };
  return {
    post: (message: LibraryMessage) => channel.postMessage(message),
    close: () => channel.close(),
  };
}

/** Tell other tabs a collection changed, e.g. after a notebook upload. */
export function announce(message: LibraryMessage): void {
  const channel = openLibraryChannel();
  channel.post(message);
  channel.close();
}
