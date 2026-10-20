import { z } from 'zod';

import {
  isLibraryLocale,
  LIBRARY_LOCALES,
  type LibraryLocale,
  negotiateLocale,
} from './locale';

/**
 * Personal preferences shared by every app on the library hostname. One cookie, so the theme,
 * the language and the 3D renderer follow the reader from the hall into a collection and back.
 */
export const LIBRARY_PREFS_COOKIE = 'library-prefs';
export const LIBRARY_PREFS_MAX_AGE = 60 * 60 * 24 * 365;

export const SCHEMES = ['system', 'light', 'dark'] as const;
export type Scheme = (typeof SCHEMES)[number];

const prefsSchema = z.object({
  scheme: z.enum(SCHEMES).catch('system'),
  /** A renderer id the hall understands; unknown ids are the hall's to reject. */
  renderer: z.string().min(1).max(64).nullable().catch(null),
  /** The language the reader picked; `null` follows the browser's `Accept-Language`. */
  locale: z.enum(LIBRARY_LOCALES).nullable().catch(null),
});
export type LibraryPrefs = z.infer<typeof prefsSchema>;

export const DEFAULT_LIBRARY_PREFS: LibraryPrefs = {
  scheme: 'system',
  renderer: null,
  locale: null,
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

/**
 * The locale a request should render in: the reader's pick from the prefs cookie, else the
 * browser's `Accept-Language`, else the library default.
 */
export function resolveLibraryLocale(
  prefsCookie: string | undefined | null,
  acceptLanguage: string | undefined | null,
): LibraryLocale {
  return (
    parseLibraryPrefs(prefsCookie).locale ?? negotiateLocale(acceptLanguage)
  );
}

/** The prefs cookie's raw value in a `Cookie` header. */
export function libraryPrefsFromCookieHeader(
  cookieHeader: string | null | undefined,
): string | null {
  for (const part of (cookieHeader ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === LIBRARY_PREFS_COOKIE) return rest.join('=');
  }
  return null;
}

/** {@link resolveLibraryLocale} for a request's headers, for a proxy or middleware. */
export function libraryLocaleOfRequest(headers: Headers): LibraryLocale {
  return resolveLibraryLocale(
    libraryPrefsFromCookieHeader(headers.get('cookie')),
    headers.get('accept-language'),
  );
}

/**
 * Where a library app's proxy sends a page request. Pages live under `/{locale}` but the URL
 * never shows it: an unprefixed path is rewritten to the reader's locale, and a prefixed one
 * is redirected to its unprefixed form, so the prefs cookie always decides. The proxy only
 * sees the browser's request, never its own rewrite, so this cannot loop.
 */
export type LibraryLocaleRoute =
  | { kind: 'rewrite'; pathname: string }
  | { kind: 'redirect'; pathname: string };

export function routeLibraryLocale(
  pathname: string,
  headers: Headers,
): LibraryLocaleRoute {
  const [, first, ...rest] = pathname.split('/');
  if (isLibraryLocale(first)) {
    return { kind: 'redirect', pathname: `/${rest.join('/')}` };
  }
  const locale = libraryLocaleOfRequest(headers);
  return {
    kind: 'rewrite',
    pathname: `/${locale}${pathname === '/' ? '' : pathname}`,
  };
}
