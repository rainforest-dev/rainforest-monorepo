'use client';

import {
  DEFAULT_LIBRARY_LOCALE,
  type LibraryLocale,
} from '@rainforest-dev/library-contract';
import type { i18n } from 'i18next';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from 'react';

import {
  createLibraryI18n,
  type LibraryResources,
  type LibraryT,
} from './i18n';
import { readLibraryPrefs } from './prefs';
import { openLibraryChannel } from './shared-state';

interface I18nContextValue {
  locale: LibraryLocale;
  i18n: i18n;
}

// Without a provider the shell still renders, in the default locale with its own strings.
const I18nContext = createContext<I18nContextValue | null>(null);
let fallback: I18nContextValue | undefined;

function useI18nContext(): I18nContextValue {
  const value = useContext(I18nContext);
  if (value) return value;
  fallback ??= {
    locale: DEFAULT_LIBRARY_LOCALE,
    i18n: createLibraryI18n(DEFAULT_LIBRARY_LOCALE),
  };
  return fallback;
}

interface ProviderProps {
  locale: LibraryLocale;
  /** The app's dictionaries; only `locale`'s are needed, so pass just those to the client. */
  resources: LibraryResources;
  children: ReactNode;
}

/**
 * Gives client components the page's locale and translator. A page the bfcache restores, or
 * one open in another tab, was rendered before the reader may have switched language, so it
 * reloads when the cookie's pick no longer matches it.
 */
export function LibraryI18nProvider({
  locale,
  resources,
  children,
}: ProviderProps) {
  const value = useMemo(
    () => ({ locale, i18n: createLibraryI18n(locale, resources) }),
    [locale, resources],
  );

  useEffect(() => {
    const check = () => {
      const picked = readLibraryPrefs().locale;
      if (picked && picked !== locale) window.location.reload();
    };
    // An open BroadcastChannel can keep a page out of the bfcache, so it is closed while the
    // page is hidden and reopened when it is shown.
    let channel: ReturnType<typeof openLibraryChannel> | null = null;
    const open = () => {
      channel ??= openLibraryChannel((message) => {
        if (message.type === 'prefs-changed') check();
      });
    };
    const close = () => {
      channel?.close();
      channel = null;
    };
    const onPageShow = (event: PageTransitionEvent) => {
      open();
      if (event.persisted) check();
    };
    open();
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', close);
    return () => {
      close();
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pagehide', close);
    };
  }, [locale]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

/** The page's locale. */
export function useLibraryLocale(): LibraryLocale {
  return useI18nContext().locale;
}

/** A translator for `namespace`, the shell's own when omitted. */
export function useLibraryT(namespace?: string): LibraryT {
  const { locale, i18n } = useI18nContext();
  return useMemo(
    () => i18n.getFixedT(locale, namespace),
    [i18n, locale, namespace],
  );
}
