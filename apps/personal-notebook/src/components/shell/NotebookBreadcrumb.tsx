'use client';

import { LibraryBreadcrumb } from '@rainforest-dev/library-shell';
import Link from 'next/link';

import { BASE_PATH } from '@/lib';

/** Notebooks › the notebook's name, linking back with this app's router. */
export function NotebookBreadcrumb({ name }: { name: string }) {
  return (
    <LibraryBreadcrumb
      current="notebooks"
      page={name}
      renderLink={({ children, href, ...props }) => (
        <Link
          href={href.slice(BASE_PATH.length) || '/'}
          prefetch={false}
          {...props}
        >
          {children}
        </Link>
      )}
    />
  );
}
