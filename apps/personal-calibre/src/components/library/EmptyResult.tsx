'use client';

import {
  Button,
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@rainforest-dev/rainforest-react';
import { SearchX } from 'lucide-react';

import { useLibrary } from '@/providers';

export function EmptyResult({ filtered }: { filtered: boolean }) {
  const { clearFilters } = useLibrary();
  return (
    <Empty className="py-20">
      <EmptyHeader>
        {filtered && (
          <EmptyMedia variant="icon">
            <SearchX aria-hidden />
          </EmptyMedia>
        )}
        <EmptyTitle>
          {filtered
            ? 'No books match these filters.'
            : 'No books in this library yet.'}
        </EmptyTitle>
      </EmptyHeader>
      {filtered && (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
