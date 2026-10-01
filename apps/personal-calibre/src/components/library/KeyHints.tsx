'use client';

import { Kbd, KbdGroup } from '@rainforest-dev/rainforest-react';

import { hintsFor } from '@/lib';
import { useLibrary } from '@/providers';

export function KeyHints() {
  const { view, pageInfo } = useLibrary();
  return (
    <div
      data-key-hints
      className="bg-background text-muted-foreground sticky bottom-0 z-10 hidden flex-wrap items-center gap-x-4 gap-y-1 border-t py-2 text-xs lg:flex"
    >
      {hintsFor(view, pageInfo.pageCount > 1).map((hint) => (
        <span key={hint.label} className="inline-flex items-center gap-1">
          <KbdGroup>
            {hint.keys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
          {hint.label}
        </span>
      ))}
    </div>
  );
}
