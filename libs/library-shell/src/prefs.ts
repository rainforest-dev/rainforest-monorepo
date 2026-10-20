import {
  LIBRARY_PREFS_COOKIE,
  LIBRARY_PREFS_MAX_AGE,
  type LibraryPrefs,
  parseLibraryPrefs,
  serializeLibraryPrefs,
} from '@rainforest-dev/library-contract';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

/** The shared prefs cookie, read in the browser. Defaults on the server. */
export function readLibraryPrefs(): LibraryPrefs {
  return parseLibraryPrefs(readCookie(LIBRARY_PREFS_COOKIE));
}

/** Merges `patch` into the shared prefs cookie, for every app on the hostname (`Path=/`). */
export function writeLibraryPrefs(patch: Partial<LibraryPrefs>): void {
  const next = { ...readLibraryPrefs(), ...patch };
  document.cookie = `${LIBRARY_PREFS_COOKIE}=${serializeLibraryPrefs(next)}; Path=/; Max-Age=${LIBRARY_PREFS_MAX_AGE}; SameSite=Lax`;
}
