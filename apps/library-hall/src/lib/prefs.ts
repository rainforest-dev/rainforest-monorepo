import type { LibraryPrefs } from '@rainforest-dev/library-contract';

// The hall page is static so the back button can restore it from the bfcache, which rules out
// reading cookies on the server: the shared prefs cookie is read in the browser.
export {
  readLibraryPrefs,
  writeLibraryPrefs,
} from '@rainforest-dev/library-shell';

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

export function rendererPref(prefs: LibraryPrefs): Renderer {
  return isRenderer(prefs.renderer) ? prefs.renderer : DEFAULT_RENDERER;
}

export function isDebug(params: URLSearchParams): boolean {
  const value = params.get('debug');
  return value !== null && value !== '0' && value !== 'false';
}
