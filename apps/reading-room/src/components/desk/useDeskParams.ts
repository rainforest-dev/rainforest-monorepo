import { useCallback, useEffect, useState } from 'react';

import {
  buildDeskSearch,
  type DeskParams,
  type DeskPatch,
  type HistoryMode,
  historyMode,
  parseDeskParams,
  patchDeskParams,
} from '@/lib/desk';

function writeUrl(params: DeskParams, mode: HistoryMode): void {
  const url = `${window.location.pathname}${buildDeskSearch(params)}${window.location.hash}`;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(window.history.state, '', url);
}

export function useDeskParams(initial: DeskParams) {
  const [params, setParams] = useState(initial);

  useEffect(() => {
    const onPopState = () => setParams(parseDeskParams(window.location.search));
    if (initial.validate) writeUrl(initial, 'replace');
    else if (window.location.search !== buildDeskSearch(initial)) onPopState();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [initial]);

  const navigate = useCallback(
    (patch: DeskPatch, mode?: HistoryMode) => {
      const next = patchDeskParams(params, patch);
      writeUrl(next, mode ?? historyMode(params, next));
      setParams(next);
    },
    [params],
  );

  return { params, navigate };
}
