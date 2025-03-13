import { enUS, type Locale, zhTW } from 'date-fns/locale';

export const fallbackLng = 'en' as const;
export const supportedLngs = [fallbackLng, 'zh'] as const;
export const cookieName = 'i18next' as const;
export const defaultNS = 'common' as const;
export const showDefaultLanguage = false as const;

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

export const locales: {
  [key in (typeof supportedLngs)[number]]: Locale;
} = {
  en: enUS,
  zh: zhTW,
};
