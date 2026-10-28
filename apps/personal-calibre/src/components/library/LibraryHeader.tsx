'use client';

import {
  LibraryBar,
  type RenderShellLink,
} from '@rainforest-dev/library-shell';
import Link from 'next/link';

import { BASE_PATH } from '@/lib';

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
  return (
    <LibraryBar
      current="books"
      renderLink={renderLink}
      sections={isList && <LibrarySections />}
    />
  );
}
