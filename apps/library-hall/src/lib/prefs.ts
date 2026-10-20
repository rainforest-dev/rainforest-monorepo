import {
  LIBRARY_PREFS_COOKIE,
  LIBRARY_PREFS_MAX_AGE,
  type LibraryPrefs,
  parseLibraryPrefs,
  serializeLibraryPrefs,
} from '@rainforest-dev/library-contract';

export const RENDERERS = [
  'css',
  'three-glsl',
  'three-tsl',
  'three-pathtrace',
] as const;
export type Renderer = (typeof RENDERERS)[number];
export const DEFAULT_RENDERER: Renderer = 'three-tsl';

export function isRenderer(value: unknown): value is Renderer {
  return RENDERERS.some((r) => r === value);
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

/**
 * The shared prefs cookie, read in the browser. The hall page is static so the back button can
 * restore it from the bfcache, which rules out reading cookies on the server.
 */
export function readLibraryPrefs(): LibraryPrefs {
  return parseLibraryPrefs(readCookie(LIBRARY_PREFS_COOKIE));
}

export function writeLibraryPrefs(patch: Partial<LibraryPrefs>): void {
  const next = { ...readLibraryPrefs(), ...patch };
  document.cookie = `${LIBRARY_PREFS_COOKIE}=${serializeLibraryPrefs(next)}; Path=/; Max-Age=${LIBRARY_PREFS_MAX_AGE}; SameSite=Lax`;
}

export function rendererPref(prefs: LibraryPrefs): Renderer {
  return isRenderer(prefs.renderer) ? prefs.renderer : DEFAULT_RENDERER;
}

export function isDebug(params: URLSearchParams): boolean {
  const value = params.get('debug');
  return value !== null && value !== '0' && value !== 'false';
}
