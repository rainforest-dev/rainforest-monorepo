import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { useEffect, useState } from 'react';
import {
  initReactI18next,
  useTranslation as _useTranslation,
} from 'react-i18next';

import { fallbackLng, getOptions, supportedLngs } from './settings';

const isServerSide = typeof window === 'undefined';

i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .use(
    resourcesToBackend(
      (lng: string, ns: string) =>
        import(`../../../public/locales/${lng}/${ns}.json`)
    )
  )
  .init({
    ...getOptions(),
    debug: true,
    lng: undefined,
    detection: {
      order: ['path', 'htmlTag', 'cookie', 'navigator'],
    },
    preload: isServerSide ? supportedLngs : [],
  });

export const useTranslation = (
  lng: string = fallbackLng,
  ns?: string | string[]
) => {
  const { i18n, ...rest } = _useTranslation(ns);
  if (isServerSide && lng && i18n.resolvedLanguage !== lng) {
    i18n.changeLanguage(lng);
    return { i18n, ...rest };
  } else {
    const [activeLng, setActiveLng] = useState(i18n.resolvedLanguage);

    useEffect(() => {
      if (activeLng === i18n.resolvedLanguage) return;
      setActiveLng(i18n.resolvedLanguage);
    }, [activeLng, i18n.resolvedLanguage]);
    useEffect(() => {
      if (!lng || i18n.resolvedLanguage === lng) return;
      i18n.changeLanguage(lng);
    }, [lng, i18n]);

    return { i18n, ...rest };
  }
};
