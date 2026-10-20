'use client';

import {
  CollectionNav,
  CollectionTabBar,
  type RenderShellLink,
  ShellHeader,
  ShellLayout,
  useReturnPoint,
} from '@rainforest-dev/library-shell';
import { NotebookPen } from 'lucide-react';
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
  useReturnPoint('notebooks');
  return (
    <ShellLayout
      mode="page"
      isDesktop={isDesktop}
      header={
        <ShellHeader>
          <Link
            href="/"
            prefetch={false}
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <NotebookPen className="size-5" aria-hidden />
            Notebooks
          </Link>
          <CollectionNav
            current="notebooks"
            renderLink={renderLink}
            resume
            className="ml-auto"
          />
        </ShellHeader>
      }
    >
      <div className="pb-20 sm:pb-0">{children}</div>
      <CollectionTabBar current="notebooks" renderLink={renderLink} resume />
    </ShellLayout>
  );
}
