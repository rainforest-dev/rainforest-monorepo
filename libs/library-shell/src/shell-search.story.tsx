import type { LibraryLocale } from '@rainforest-dev/library-contract';

import { LibraryI18nProvider } from './i18n-provider';
import { ShellSearch } from './shell-search';

interface Props {
  locale?: LibraryLocale;
}

/** The library-wide search box. Tests answer `/api/search` with `page.route()`. */
export const Default = ({ locale = 'zh' }: Props) => (
  <LibraryI18nProvider locale={locale} resources={{}}>
    <ShellSearch />
  </LibraryI18nProvider>
);
