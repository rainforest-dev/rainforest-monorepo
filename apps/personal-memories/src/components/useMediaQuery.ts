import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string, serverValue = true): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    () => matchMedia(query).matches,
    () => serverValue,
  );
}
