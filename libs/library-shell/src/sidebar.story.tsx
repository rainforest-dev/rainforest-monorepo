import type { LibraryLocale } from '@rainforest-dev/library-contract';

import { LibraryI18nProvider } from './i18n-provider';
import { SHELL_IDS } from './ids';
import { SIDEBAR_COLUMN } from './layout';
import { SidebarToggle } from './sidebar';

interface Props {
  locale?: LibraryLocale;
}

/** A page with a left column: the toggle shows from `lg` up and hides the column. */
export const WithColumn = ({ locale = 'en' }: Props) => (
  <LibraryI18nProvider locale={locale} resources={{}}>
    <SidebarToggle />
    <aside id={SHELL_IDS.sidebar} className={SIDEBAR_COLUMN}>
      Filters
    </aside>
  </LibraryI18nProvider>
);

/** A page with no left column, where CSS hides the toggle. */
export const WithoutColumn = ({ locale = 'en' }: Props) => (
  <LibraryI18nProvider locale={locale} resources={{}}>
    <SidebarToggle />
  </LibraryI18nProvider>
);
