'use client';

import {
  LibraryBar,
  type RenderShellLink,
  ShellLayout,
} from '@rainforest-dev/library-shell';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { useIsDesktop } from '@/hooks';
import { BASE_PATH } from '@/lib';

// The router adds the base path itself, so this app's own tab links to `/`; every other
// collection is another app and gets a full page load.
const renderLink: RenderShellLink = (
  { children, href, ...props },
  collection,
) =>
  collection.id === 'notebooks' ? (
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

export function NotebookShell({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop();
  return (
    <ShellLayout
      mode="page"
      isDesktop={isDesktop}
      header={<LibraryBar current="notebooks" renderLink={renderLink} />}
    >
      {children}
    </ShellLayout>
  );
}
