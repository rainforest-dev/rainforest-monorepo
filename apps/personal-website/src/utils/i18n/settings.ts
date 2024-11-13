export const fallbackLng = 'en' as const;
export const supportedLngs = [fallbackLng, 'zh'] as const;
export const cookieName = 'i18next' as const;
export const defaultNS = 'common' as const;

export const getOptions = (
  lng: string = fallbackLng,
  ns?: string | string[]
) => ({
  supportedLngs,
  fallbackLng,
  lng,
  fallbackNS: defaultNS,
  defaultNS,
  ns: [defaultNS, ...(Array.isArray(ns) ? ns : ns ? [ns] : [])],
});
