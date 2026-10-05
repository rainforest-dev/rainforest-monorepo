import { z } from 'zod';

export const VIEWS = ['shelf', 'catalogue', 'study'] as const;
export type View = (typeof VIEWS)[number];
export const ENABLED_VIEWS: readonly View[] = ['shelf', 'catalogue'];
export const VIEW_LABELS: Record<View, string> = {
  shelf: 'Shelf',
  catalogue: 'Catalogue',
  study: 'Study',
};

export const RENDERERS = ['css', 'three-glsl', 'three-tsl'] as const;
export type Renderer = (typeof RENDERERS)[number];

export const PREFS_COOKIE = 'calibre-prefs';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export interface Prefs {
  view: View;
  panel: boolean;
  renderer: Renderer;
}

export const DEFAULT_PREFS: Prefs = {
  view: 'shelf',
  panel: true,
  renderer: 'three-tsl',
};

const prefsSchema = z.object({
  view: z.enum(VIEWS).catch(DEFAULT_PREFS.view),
  panel: z.boolean().catch(DEFAULT_PREFS.panel),
  renderer: z.enum(RENDERERS).catch(DEFAULT_PREFS.renderer),
});

export function isView(value: unknown): value is View {
  return VIEWS.some((v) => v === value);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function decodeCookie(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function parsePrefs(raw: string | undefined): Prefs {
  if (!raw) return { ...DEFAULT_PREFS };
  const value = parseJson(raw) ?? parseJson(decodeCookie(raw));
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_PREFS };
  const result = prefsSchema.safeParse(value);
  return result.success ? result.data : { ...DEFAULT_PREFS };
}

export function resolveView(
  prefView: View,
  param: string | null,
  enabled: readonly View[] = ENABLED_VIEWS,
): View {
  const wanted = VIEWS.find((v) => v === param);
  if (wanted && enabled.includes(wanted)) return wanted;
  if (enabled.includes(prefView)) return prefView;
  return enabled[0] ?? 'shelf';
}

export function nextView(
  view: View,
  enabled: readonly View[] = ENABLED_VIEWS,
): View {
  const index = enabled.indexOf(view);
  return enabled[(index + 1) % enabled.length] ?? 'shelf';
}

export function serializePrefs(prefs: Prefs): string {
  return `${PREFS_COOKIE}=${encodeURIComponent(JSON.stringify(prefs))}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}
