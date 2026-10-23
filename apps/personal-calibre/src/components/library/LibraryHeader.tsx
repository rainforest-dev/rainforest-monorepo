'use client';

import {
  LibraryBar,
  type RenderShellLink,
  SHELL_IDS,
  useLibraryT,
} from '@rainforest-dev/library-shell';
import { Badge, Button } from '@rainforest-dev/rainforest-react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { BASE_PATH, filterCount, parseLibraryParams } from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';
import { useLibrary } from '@/providers';

import { SearchField } from './SearchField';
import { ViewSwitch } from './ViewSwitch';

// The router adds the base path itself, so this app's own tab links to `/`; every other
// collection is another app and gets a full page load.
const renderLink: RenderShellLink = (
  { children, href, ...props },
  collection,
) =>
  collection.id === 'books' ? (
    <Link
      href={href.slice(BASE_PATH.length) || '/'}
      prefetch={false}
      {...props}
    >
      {children}
    </Link>
  ) : (
    <a href={href} {...props}>
      {children}
    </a>
  );

/**
 * The library's shared top bar with the catalogue's own controls. On the list, its own search
 * field stands in for the library-wide one.
 */
export function LibraryHeader({ isList }: { isList: boolean }) {
  const { panelOpen, togglePanel } = useLibrary();
  const params = parseLibraryParams(useSearchParams());
  const count = filterCount(params);
  const t = useLibraryT(CALIBRE_NAMESPACE);
  return (
    <LibraryBar
      current="books"
      renderLink={renderLink}
      search={!isList}
      leading={
        isList && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden lg:inline-flex"
            aria-label={panelOpen ? t('filters.hide') : t('filters.show')}
            aria-expanded={panelOpen}
            aria-controls={SHELL_IDS.filters}
            onClick={togglePanel}
          >
            {panelOpen ? (
              <PanelLeftClose aria-hidden />
            ) : (
              <PanelLeftOpen aria-hidden />
            )}
          </Button>
        )
      }
    >
      {isList && <ViewSwitch className="ml-auto lg:ml-2" />}
      {isList && (
        <div className="order-last w-full lg:order-none lg:mx-auto lg:w-auto lg:max-w-[420px] lg:flex-1">
          <SearchField initialQuery={params.q ?? ''} />
        </div>
      )}
      {isList && !panelOpen && count > 0 && (
        <Badge variant="secondary" className="hidden lg:inline-flex">
          {t('filters.badge', { count })}
        </Badge>
      )}
    </LibraryBar>
  );
}
