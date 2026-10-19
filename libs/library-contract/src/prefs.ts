import { z } from 'zod';

/**
 * Personal preferences shared by every app on the library hostname. One cookie, so the theme
 * and the 3D renderer follow the reader from the hall into a collection and back.
 */
export const LIBRARY_PREFS_COOKIE = 'library-prefs';
export const LIBRARY_PREFS_MAX_AGE = 60 * 60 * 24 * 365;

export const SCHEMES = ['system', 'light', 'dark'] as const;
export type Scheme = (typeof SCHEMES)[number];

const prefsSchema = z.object({
  scheme: z.enum(SCHEMES).catch('system'),
  /** A renderer id the hall understands; unknown ids are the hall's to reject. */
  renderer: z.string().min(1).max(64).nullable().catch(null),
});
export type LibraryPrefs = z.infer<typeof prefsSchema>;

export const DEFAULT_LIBRARY_PREFS: LibraryPrefs = {
  scheme: 'system',
  renderer: null,
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function parseLibraryPrefs(
  raw: string | undefined | null,
): LibraryPrefs {
  if (!raw) return { ...DEFAULT_LIBRARY_PREFS };
  const value = parseJson(raw) ?? parseJson(decode(raw));
  if (typeof value !== 'object' || value === null)
    return { ...DEFAULT_LIBRARY_PREFS };
  const result = prefsSchema.safeParse({ ...DEFAULT_LIBRARY_PREFS, ...value });
  return result.success ? result.data : { ...DEFAULT_LIBRARY_PREFS };
}

/** The cookie's value, URI-encoded so it survives every cookie parser. */
export function serializeLibraryPrefs(prefs: LibraryPrefs): string {
  return encodeURIComponent(JSON.stringify(prefs));
}
