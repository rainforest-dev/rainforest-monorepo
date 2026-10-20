import { useSyncExternalStore } from 'react';

const DESKTOP_QUERY = '(min-width: 64rem)';

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

const unsubscribe = () => undefined;
const subscribeNever = () => unsubscribe;

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

export interface DeskLayout {
  isDesktop: boolean;
  showTable: boolean;
  showList: boolean;
}

export function useDeskLayout(): DeskLayout {
  const isDesktop = useIsDesktop();
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  return {
    isDesktop,
    showTable: !hydrated || isDesktop,
    showList: !hydrated || !isDesktop,
  };
}
