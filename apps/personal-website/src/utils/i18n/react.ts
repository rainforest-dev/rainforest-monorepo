import i18next from 'i18next';
import { useEffect, useState } from 'react';
import {
  initReactI18next,
  useTranslation as _useTranslation,
} from 'react-i18next';

import { isServerSide } from '..';
import { createInstance, fallbackLng, initI18nextClient } from '.';

let instance = i18next.createInstance();
instance.use(initReactI18next);
instance = createInstance(instance);
await initI18nextClient(instance);

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
