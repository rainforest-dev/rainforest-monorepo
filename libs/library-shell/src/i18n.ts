import {
  DEFAULT_LIBRARY_LOCALE,
  type LibraryLocale,
} from '@rainforest-dev/library-contract';
import i18next, { type i18n, type TFunction } from 'i18next';

import { SHELL_RESOURCES } from './locales';

/** A translator, as `useLibraryT` and `libraryT` return it. */
export type LibraryT = TFunction;

/** One locale's namespaces, each a nested dictionary of strings. */
export type LocaleResources = Record<string, object>;
/** An app's dictionaries: every namespace in every locale it ships. */
export type LibraryResources = Partial<Record<LibraryLocale, LocaleResources>>;

export const SHELL_NAMESPACE = 'shell';

/**
 * An i18next instance for one locale, ready on return: the resources are in memory, so a
 * server component can translate without awaiting. The shell's own namespace is always in.
 */
export function createLibraryI18n(
  locale: LibraryLocale,
  resources: LibraryResources = {},
): i18n {
  const instance = i18next.createInstance();
  const merged = Object.fromEntries(
    (Object.keys(SHELL_RESOURCES) as LibraryLocale[]).map((lng) => [
      lng,
      { [SHELL_NAMESPACE]: SHELL_RESOURCES[lng], ...resources[lng] },
    ]),
  );
  void instance.init({
    lng: locale,
    fallbackLng: DEFAULT_LIBRARY_LOCALE,
    resources: merged,
    ns: Object.keys(merged[locale] ?? {}),
    defaultNS: SHELL_NAMESPACE,
    initAsync: false,
    // React escapes text it renders.
    interpolation: { escapeValue: false },
    returnNull: false,
    showSupportNotice: false,
  });
  return instance;
}

/** A translator for `namespace` in `locale`, for code that renders outside React context. */
export function libraryT(
  locale: LibraryLocale,
  resources: LibraryResources,
  namespace: string,
): LibraryT {
  return createLibraryI18n(locale, resources).getFixedT(locale, namespace);
}
