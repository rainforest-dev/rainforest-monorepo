import { useCallback, useEffect, useState } from 'react';

import { cleanName } from '@/lib/notes';

const KEY = 'memories:author-name';

export function useAuthorName(
  viewer: string | undefined,
  roster: readonly string[],
) {
  const [stored, setStored] = useState<string>();
  const [resolved, setResolved] = useState(false);
  useEffect(() => {
    try {
      setStored(localStorage.getItem(KEY) ?? undefined);
    } catch {
      setStored(undefined);
    }
    setResolved(true);
  }, []);
  const save = useCallback((raw: string) => {
    const name = cleanName(raw);
    setStored(name || undefined);
    try {
      if (name) localStorage.setItem(KEY, name);
      else localStorage.removeItem(KEY);
    } catch {
      return;
    }
  }, []);
  const known =
    stored && (roster.length === 0 || roster.includes(stored))
      ? stored
      : undefined;
  return {
    name: viewer ?? known,
    needsName: resolved && !viewer && !known,
    save,
  };
}
