import { isServerSide } from '..';
import { fallbackLng, showDefaultLanguage, supportedLngs } from './settings';

export const getLangFromUrl = (url?: URL | string) => {
  if (isServerSide) return fallbackLng;
  if (!url) url = location.href;
  if (typeof url === 'string') url = new URL(url);
  const [, lang] = url.pathname.split('/');
  if (([...supportedLngs] as string[]).includes(lang)) return lang;
  return fallbackLng;
};

export const useTranslatedPath = (_lang: string = fallbackLng) => {
  if (!supportedLngs.includes(_lang as (typeof supportedLngs)[number])) {
    _lang = fallbackLng;
  }
  return function translatePath(path: string, lang = _lang) {
    return !showDefaultLanguage && lang === fallbackLng
      ? path
      : `/${lang}${path}`;
  };
};
