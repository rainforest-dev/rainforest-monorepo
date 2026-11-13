'use client';

import {
  type CollectionId,
  collectionLabel,
  getCollection,
} from '@rainforest-dev/library-contract';
import { type ReactNode } from 'react';

import {
  COLLECTION_ICONS,
  CollectionNav,
  CollectionTabBar,
  type RenderShellLink,
} from './collection-nav';
import { useFoldAnchor } from './fold';
import { useReturnPoint } from './hooks';
import { useLibraryLocale, useLibraryT } from './i18n-provider';
import { LocaleSwitch } from './locale-switch';
import { ShellHeader } from './shell-header';
import { ShellSearch } from './shell-search';
import { SidebarToggle } from './sidebar';

const HallIcon = COLLECTION_ICONS.hall;

export interface LibraryBarProps {
  current: CollectionId;
  /** Renders this app's own collection links with its router; others stay plain anchors. */
  renderLink?: RenderShellLink;
  /** Before the library's name, after the sidebar toggle. */
  leading?: ReactNode;
  /** The current collection's own controls, after the switcher. */
  children?: ReactNode;
  /**
   * The collection's second level, a `SectionNav`: the row right under the bar. A search
   * within the collection goes there too, so the bar's search is always the whole library.
   */
  sections?: ReactNode;
  /**
   * Whether the other collections are reachable. Off on an app's old hostname, where only that
   * app is served: the bar then names the collection and links nowhere else.
   */
  collections?: boolean;
}

/**
 * The one top bar every collection shows, in the same order everywhere: the library's name
 * (back to the hall), the collection switcher, the collection's own controls, the library-wide
 * search and the language switch. The library-wide search is never swapped for a narrower one,
 * and is left out only on an old hostname, which does not serve it. Below `sm` the switcher moves to the bottom tab bar. Every
 * collection link opens that collection's front page, so a tab is always the same place; where
 * this tab left the collection is still remembered, for a "carry on" link to offer.
 */
export function LibraryBar({
  current,
  renderLink,
  leading,
  children,
  sections,
  collections = true,
}: LibraryBarProps) {
  useReturnPoint(current);
  useFoldAnchor();
  const t = useLibraryT();
  const locale = useLibraryLocale();
  const own = getCollection(current);
  const Icon = collections ? HallIcon : COLLECTION_ICONS[current];
  return (
    <>
      <ShellHeader data-library-bar={current}>
        {/* Shown only on a page whose left column is in the DOM; see tailwind.css. */}
        <SidebarToggle />
        {leading}
        <a
          href={collections ? '/' : own.basePath}
          data-library-home
          className="flex h-10 shrink-0 items-center gap-2 rounded-md font-semibold tracking-tight"
        >
          <Icon className="text-primary size-5" aria-hidden />
          {collections ? t('brand') : collectionLabel(own, locale)}
        </a>
        {collections && (
          <CollectionNav current={current} renderLink={renderLink} />
        )}
        {children}
        {collections && (
          <ShellSearch className="order-last w-full lg:order-none lg:ml-auto lg:w-80" />
        )}
        <LocaleSwitch className={collections ? 'ml-auto lg:ml-0' : 'ml-auto'} />
      </ShellHeader>
      {sections}
      {collections && (
        <CollectionTabBar current={current} renderLink={renderLink} />
      )}
    </>
  );
}
