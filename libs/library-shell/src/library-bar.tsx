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
import { useReturnPoint } from './hooks';
import { useLibraryLocale, useLibraryT } from './i18n-provider';
import { LocaleSwitch } from './locale-switch';
import { ShellHeader } from './shell-header';
import { ShellSearch } from './shell-search';

const HallIcon = COLLECTION_ICONS.hall;

export interface LibraryBarProps {
  current: CollectionId;
  /** Renders this app's own collection links with its router; others stay plain anchors. */
  renderLink?: RenderShellLink;
  /** Before the library's name, such as a sidebar toggle. */
  leading?: ReactNode;
  /** The current collection's own controls, after the switcher. */
  children?: ReactNode;
  /**
   * The library-wide search. Turn it off where the collection's own search field sits in
   * `children`, so the bar never shows two search boxes. Never shown without `collections`:
   * an old hostname does not serve it.
   */
  search?: boolean;
  /**
   * Whether the other collections are reachable. Off on an app's old hostname, where only that
   * app is served: the bar then names the collection and links nowhere else.
   */
  collections?: boolean;
}

/**
 * The one top bar every collection shows, in the same order everywhere: the library's name
 * (back to the hall), the collection switcher, the collection's own controls, the library-wide
 * search and the language switch. Below `sm` the switcher moves to the bottom tab bar. It also
 * remembers where this tab left the collection, so the switcher elsewhere can return here.
 */
export function LibraryBar({
  current,
  renderLink,
  leading,
  children,
  search = true,
  collections = true,
}: LibraryBarProps) {
  useReturnPoint(current);
  const t = useLibraryT();
  const locale = useLibraryLocale();
  const own = getCollection(current);
  const Icon = collections ? HallIcon : COLLECTION_ICONS[current];
  return (
    <>
      <ShellHeader data-library-bar={current}>
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
          <CollectionNav current={current} renderLink={renderLink} resume />
        )}
        {children}
        {search && collections && (
          <ShellSearch className="order-last w-full lg:order-none lg:ml-auto lg:w-80" />
        )}
        <LocaleSwitch
          className={search && collections ? 'ml-auto lg:ml-0' : 'ml-auto'}
        />
      </ShellHeader>
      {collections && (
        <CollectionTabBar current={current} renderLink={renderLink} resume />
      )}
    </>
  );
}
