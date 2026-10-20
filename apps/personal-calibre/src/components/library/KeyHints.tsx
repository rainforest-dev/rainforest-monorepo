'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import { KeyHints as KeyHintRow } from '@rainforest-dev/rainforest-react';

import { hintsFor } from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';
import { useLibrary } from '@/providers';

export function KeyHints() {
  const { view, pageInfo } = useLibrary();
  const t = useLibraryT(CALIBRE_NAMESPACE);
  return (
    <KeyHintRow
      hints={hintsFor(view, pageInfo.pageCount > 1).map((hint) => ({
        ...hint,
        label: t(`keys.${hint.label}`),
      }))}
      className="bg-background sticky bottom-0 z-10 hidden border-t py-2 lg:flex"
    />
  );
}
