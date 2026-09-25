import { useEffect, useState } from 'react';

import {
  HIDDEN_KEY,
  hiddenFrom,
  parseHidden,
  SOURCES,
  visibleFrom,
} from '../../lib/sources.ts';

export function useSourceFilter() {
  const [visible, setVisible] = useState<string[]>(() =>
    SOURCES.map((s) => s.source),
  );
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(HIDDEN_KEY);
    } catch {
      raw = null;
    }
    setVisible(visibleFrom(parseHidden(raw)));
  }, []);
  useEffect(() => {
    const stream = document.querySelector('[data-stream]');
    for (const { source } of SOURCES)
      stream?.toggleAttribute(`data-hide-${source}`, !visible.includes(source));
  }, [visible]);
  const change = (next: string[]) => {
    setVisible(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(hiddenFrom(next)));
    } catch {
      return;
    }
  };
  return { visible, change };
}
