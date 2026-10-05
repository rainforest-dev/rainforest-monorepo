import { useState } from 'react';

import { toggleName, withNames, withoutNames } from '@/lib/desk';

export interface RowSelection {
  selectMode: boolean;
  selected: ReadonlySet<string>;
  start: () => void;
  done: () => void;
  toggle: (name: string) => void;
  addMany: (names: readonly string[]) => void;
  removeMany: (names: readonly string[]) => void;
  clear: () => void;
}

export function useRowSelection(): RowSelection {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  return {
    selectMode,
    selected,
    start: () => setSelectMode(true),
    done: () => {
      setSelectMode(false);
      setSelected(new Set());
    },
    toggle: (name) => setSelected((prev) => toggleName(prev, name)),
    addMany: (names) => setSelected((prev) => withNames(prev, names)),
    removeMany: (names) => setSelected((prev) => withoutNames(prev, names)),
    clear: () => setSelected(new Set()),
  };
}
