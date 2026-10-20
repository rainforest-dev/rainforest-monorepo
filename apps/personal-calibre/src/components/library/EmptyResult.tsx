'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Button,
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@rainforest-dev/rainforest-react';
import { SearchX } from 'lucide-react';

import { CALIBRE_NAMESPACE } from '@/locales';
import { useLibrary } from '@/providers';

export function EmptyResult({ filtered }: { filtered: boolean }) {
  const { clearFilters } = useLibrary();
  const t = useLibraryT(CALIBRE_NAMESPACE);
  return (
    <Empty className="py-20">
      <EmptyHeader>
        {filtered && (
          <EmptyMedia variant="icon">
            <SearchX aria-hidden />
          </EmptyMedia>
        )}
        <EmptyTitle>
          {filtered ? t('empty.filtered') : t('empty.none')}
        </EmptyTitle>
      </EmptyHeader>
      {filtered && (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            {t('filters.clear')}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
