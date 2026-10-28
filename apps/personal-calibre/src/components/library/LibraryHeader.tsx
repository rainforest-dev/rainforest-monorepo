'use client';

import {
  LibraryBar,
  type RenderShellLink,
  SHELL_IDS,
  useLibraryT,
} from '@rainforest-dev/library-shell';
import { Button } from '@rainforest-dev/rainforest-react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';

import { BASE_PATH } from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';
import { useLibrary } from '@/providers';

import { LibrarySections } from './LibrarySections';

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
 * The library's shared top bar with the catalogue's own controls; on the list, its views and
 * book search sit in the row under it.
 */
export function LibraryHeader({ isList }: { isList: boolean }) {
  const { panelOpen, togglePanel } = useLibrary();
  const t = useLibraryT(CALIBRE_NAMESPACE);
  return (
    <LibraryBar
      current="books"
      renderLink={renderLink}
      sections={isList && <LibrarySections />}
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
    />
  );
}
