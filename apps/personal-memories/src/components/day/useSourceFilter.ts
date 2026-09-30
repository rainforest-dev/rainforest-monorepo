import { useEffect, useState } from 'react';

import { HIDDEN_KEY, hiddenFrom, SOURCES } from '../../lib/sources.ts';

const ALL = SOURCES.map((s) => s.source);

export function useSourceFilter() {
  const [stored, setStored] = useState<string[]>();
  useEffect(() => {
    const root = document.documentElement;
    setStored(ALL.filter((s) => !root.hasAttribute(`data-hide-${s}`)));
  }, []);
  useEffect(() => {
    if (!stored) return;
    for (const source of ALL)
      document.documentElement.toggleAttribute(
        `data-hide-${source}`,
        !stored.includes(source),
      );
  }, [stored]);
  const change = (next: string[]) => {
    setStored(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(hiddenFrom(next)));
    } catch {
      return;
    }
  };
  return { visible: stored ?? ALL, change };
}
