'use client';

import { SectionNav, useLibraryT } from '@rainforest-dev/library-shell';
import { Badge, Kbd } from '@rainforest-dev/rainforest-react';
import { LayoutGrid, Library, type LucideIcon, Rows3 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import {
  ENABLED_VIEWS,
  filterCount,
  isView,
  parseLibraryParams,
  type View,
} from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';
import { useLibrary } from '@/providers';

import { SearchField } from './SearchField';

const ICONS: Record<View, LucideIcon> = {
  shelf: LayoutGrid,
  catalogue: Rows3,
  study: Library,
};

/**
 * The catalogue's row under the library bar: its views, and the search within the books. The
 * bar's own search stays the library-wide one.
 */
export function LibrarySections() {
  const { view, setView, panelOpen } = useLibrary();
  const params = parseLibraryParams(useSearchParams());
  const count = filterCount(params);
  const t = useLibraryT(CALIBRE_NAMESPACE);
  return (
    <SectionNav
      label={t('view.label')}
      current={view}
      onSelect={(next) => {
        if (isView(next)) setView(next);
      }}
      items={ENABLED_VIEWS.map((item) => ({
        id: item,
        label: t(`view.${item}`),
        ariaLabel: t('view.region', { name: t(`view.${item}`) }),
        icon: ICONS[item],
      }))}
    >
      <Kbd className="hidden lg:inline-flex">v</Kbd>
      <div className="w-full lg:ml-auto lg:w-auto lg:max-w-[420px] lg:flex-1">
        <SearchField initialQuery={params.q ?? ''} />
      </div>
      {!panelOpen && count > 0 && (
        <Badge variant="secondary" className="hidden lg:inline-flex">
          {t('filters.badge', { count })}
        </Badge>
      )}
    </SectionNav>
  );
}
