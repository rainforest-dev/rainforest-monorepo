'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { NOTEBOOK_NAMESPACE } from '@/locales';

/** A client component, so the page can render it before its `params` resolve. */
export function BackLink() {
  const t = useLibraryT(NOTEBOOK_NAMESPACE);
  return (
    <Link
      href="/"
      prefetch={false}
      className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {t('notebook.back')}
    </Link>
  );
}
