'use client';

import { LibraryBar } from '@rainforest-dev/library-shell';

/** The library's shared top bar, as the hall shows it. */
export function HallHeader() {
  return <LibraryBar current="hall" />;
}
