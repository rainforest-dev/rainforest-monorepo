'use client';

import { LibraryBreadcrumb } from '@rainforest-dev/library-shell';
import Link from 'next/link';

import { BASE_PATH } from '@/lib';

/** Books › the book's title. The way back is the catalogue's own route, kept client-side. */
export function BookBreadcrumb({ title }: { title: string }) {
  return (
    <LibraryBreadcrumb
      current="books"
      page={title}
      renderLink={({ children, href, ...props }) => (
        <Link href={href.slice(BASE_PATH.length) || '/'} {...props}>
          {children}
        </Link>
      )}
    />
  );
}
