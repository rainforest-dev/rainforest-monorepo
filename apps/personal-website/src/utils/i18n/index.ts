import type { i18n as I18nInstance, TFunction } from 'i18next';
import i18next from 'i18next';
import ChainedBackend, { ChainedBackendOptions } from 'i18next-chained-backend';
import HttpBackend from 'i18next-http-backend';
import resourcesToBackend from 'i18next-resources-to-backend';

import { fallbackLng, getOptions, supportedLngs } from './settings';

const initI18next = async (lng: string, ns?: string | string[]) => {
  const instance = i18next.createInstance();
  await instance
    .use(ChainedBackend)
    .use(
      resourcesToBackend(
        (lng: string, ns: string) =>
          import(`../../../public/locales/${lng}/${ns}.json`)
      )
    )
    .init<ChainedBackendOptions>({
      ...getOptions(lng, ns),
      // debug: true,
      backend: {
        backends: [HttpBackend],
        backendOptions: [
          {
            loadPath: '/locales/{{lng}}/{{ns}}.json',
          },
        ],
      },
    });
  return instance;
};

export const getLangFromUrl = (url: URL | string) => {
  if (typeof url === 'string') url = new URL(url);
  const [, lang] = url.pathname.split('/');
  if (([...supportedLngs] as string[]).includes(lang)) return lang;
  return fallbackLng;
};

export const useTranslation = async (
  lng: string = fallbackLng,
  ns?: string | string[]
): Promise<{ t: TFunction; i18n: I18nInstance }> => {
  const instance = await initI18next(lng, ns);
  return {
    t: instance.getFixedT(lng, Array.isArray(ns) ? ns[0] : ns),
    i18n: instance,
  };
};

export * from './settings';
