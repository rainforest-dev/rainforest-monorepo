import {
  hasModifier,
  isInOverlay,
  isTypingTarget,
  listenForShortcuts,
} from '@rainforest-dev/rainforest-ui/interaction';
import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';

import {
  type DeskTab,
  resolveDeskKey,
  type RowKeyState,
  type ViewCommand,
  type ViewKeyState,
} from '@/lib/desk';

export interface ViewKeys {
  state: ViewKeyState;
  rowAt: (
    target: EventTarget | null,
  ) => (RowKeyState & { name: string }) | null;
  run: (
    command: ViewCommand,
    row: string | null,
    target: Element | null,
  ) => void;
}

export type ViewKeysRef = RefObject<ViewKeys | null>;

export const DESK_SEARCH_ATTR = 'data-desk-search';

function focusSearch(tab: DeskTab) {
  document
    .querySelector<HTMLInputElement>(`[${DESK_SEARCH_ATTR}="${tab}"] input`)
    ?.focus();
}

export function useDeskShortcuts({
  tab,
  onTab,
  views,
}: {
  tab: DeskTab;
  onTab: (tab: DeskTab) => void;
  views: Partial<Record<DeskTab, ViewKeysRef>>;
}) {
  const latest = useRef({ tab, onTab, views });
  useLayoutEffect(() => {
    latest.current = { tab, onTab, views };
  });

  useEffect(
    () =>
      listenForShortcuts((event) => {
        const { tab: current, onTab: switchTab, views } = latest.current;
        const target = event.target instanceof Element ? event.target : null;
        const keys = views[current]?.current ?? null;
        const row = keys?.rowAt(target) ?? null;
        const command = resolveDeskKey({
          key: event.key,
          modified: hasModifier(event),
          typing: isTypingTarget(target),
          inOverlay: isInOverlay(target),
          view: keys?.state ?? null,
          row,
        });
        if (!command) return;
        event.preventDefault();
        if (command.type === 'tab') {
          if (command.tab !== current) switchTab(command.tab);
        } else if (command.type === 'focus-search') {
          focusSearch(current);
        } else {
          keys?.run(command, row?.name ?? null, target);
        }
      }),
    [],
  );
}
