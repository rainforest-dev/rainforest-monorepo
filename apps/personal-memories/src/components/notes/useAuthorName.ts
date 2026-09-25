import { useCallback, useEffect, useState } from 'react';

import { cleanName } from '../../lib/notes/authors.ts';

const KEY = 'memories:author-name';

export function useAuthorName(viewer: string | undefined) {
  const [stored, setStored] = useState<string>();
  useEffect(() => {
    try {
      setStored(localStorage.getItem(KEY) ?? undefined);
    } catch {
      setStored(undefined);
    }
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
  return { name: viewer ?? stored, needsName: !viewer && !stored, save };
}
