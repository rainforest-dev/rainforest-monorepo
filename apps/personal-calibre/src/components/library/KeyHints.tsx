'use client';

import { KeyHints as KeyHintRow } from '@rainforest-dev/rainforest-react';

import { hintsFor } from '@/lib';
import { useLibrary } from '@/providers';

export function KeyHints() {
  const { view, pageInfo } = useLibrary();
  return (
    <KeyHintRow
      hints={hintsFor(view, pageInfo.pageCount > 1)}
      className="bg-background sticky bottom-0 z-10 hidden border-t py-2 lg:flex"
    />
  );
}
