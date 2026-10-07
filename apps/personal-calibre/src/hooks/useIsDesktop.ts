'use client';

import { useSyncExternalStore } from 'react';

const DESKTOP_QUERY = '(min-width: 64rem)';
const FINE_POINTER_DESKTOP_QUERY = `${DESKTOP_QUERY} and (pointer: fine)`;

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}

export function useIsFinePointerDesktop(): boolean {
  return useMediaQuery(FINE_POINTER_DESKTOP_QUERY);
}
