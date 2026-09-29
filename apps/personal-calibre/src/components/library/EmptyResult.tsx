'use client';

import { Button } from '@rainforest-dev/rainforest-react';
import { SearchX } from 'lucide-react';

import { useLibrary } from './LibraryProvider';

export function EmptyResult({ filtered }: { filtered: boolean }) {
  const { clearFilters } = useLibrary();
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      {filtered ? (
        <>
          <SearchX className="text-muted-foreground size-10" aria-hidden />
          <p>No books match these filters.</p>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </>
      ) : (
        <p>No books in this library yet.</p>
      )}
    </div>
  );
}
