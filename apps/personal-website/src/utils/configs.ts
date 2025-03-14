import type { supportedLocales } from '@rainforest-dev/personal-data';
import { enUS, type Locale, zhTW } from 'date-fns/locale';

export const persistentLocaleKey = 'locale' as const;

export const locales: {
  [key in (typeof supportedLocales)[number]]: Locale;
} = {
  en: enUS,
  zh: zhTW,
};
