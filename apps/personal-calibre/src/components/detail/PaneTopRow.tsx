'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import { Button, buttonVariants, Kbd } from '@rainforest-dev/rainforest-react';
import { ExternalLink, X } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';
import { useLibrary } from '@/providers';

export function PaneTopRow({ bookId }: { bookId: number }) {
  const { closeBook } = useLibrary();
  const t = useLibraryT(CALIBRE_NAMESPACE);
  return (
    <div className="flex items-center gap-1">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {t('pane.details')}
      </p>
      <span className="text-muted-foreground ml-auto hidden items-center gap-1 pr-1 text-xs lg:inline-flex">
        <Kbd>Esc</Kbd> {t('pane.close')}
      </span>
      <Link
        href={`/books/${bookId}`}
        aria-label={t('pane.openPage')}
        title={t('pane.openPage')}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'ml-auto lg:ml-0',
        )}
      >
        <ExternalLink aria-hidden />
      </Link>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('pane.closeDetails')}
        onClick={closeBook}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}
