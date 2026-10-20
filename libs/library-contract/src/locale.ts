/**
 * The languages every app on the library hostname speaks. The codes match the personal
 * website's (`en`, `zh`); `zh` is Traditional Chinese.
 */
export const LIBRARY_LOCALES = ['zh', 'en'] as const;
export type LibraryLocale = (typeof LIBRARY_LOCALES)[number];

/** Used when neither the prefs cookie nor the browser names a language the library speaks. */
export const DEFAULT_LIBRARY_LOCALE: LibraryLocale = 'zh';

/** The `<html lang>` for each locale. */
export const HTML_LANG: Record<LibraryLocale, string> = {
  zh: 'zh-Hant',
  en: 'en',
};

export function isLibraryLocale(value: unknown): value is LibraryLocale {
  return LIBRARY_LOCALES.some((l) => l === value);
}

/**
 * The best locale for an `Accept-Language` header: the highest-weighted range whose primary
 * subtag the library speaks. Any `zh` variant maps to `zh`, since that is the only Chinese.
 */
export function negotiateLocale(
  acceptLanguage: string | null | undefined,
): LibraryLocale {
  if (!acceptLanguage) return DEFAULT_LIBRARY_LOCALE;
  const ranges = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const weight = q ? Number(q.slice(2)) : 1;
      return {
        primary: tag.toLowerCase().split('-')[0],
        weight: Number.isFinite(weight) ? weight : 0,
        index,
      };
    })
    .filter((r) => r.weight > 0)
    // Equal weights keep the header's order.
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const { primary } of ranges) {
    if (isLibraryLocale(primary)) return primary;
  }
  return DEFAULT_LIBRARY_LOCALE;
}
