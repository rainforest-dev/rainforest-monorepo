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
  type SourcesCommand,
  type SourcesKeyState,
} from '@/lib/desk';

export interface SourcesKeys {
  state: SourcesKeyState;
  rowAt: (
    target: EventTarget | null,
  ) => (RowKeyState & { name: string }) | null;
  run: (
    command: SourcesCommand,
    row: string | null,
    target: Element | null,
  ) => void;
}

export const DESK_SEARCH_ATTR = 'data-desk-search';

function focusSearch(tab: DeskTab) {
  document
    .querySelector<HTMLInputElement>(`[${DESK_SEARCH_ATTR}="${tab}"] input`)
    ?.focus();
}

export function useDeskShortcuts({
  tab,
  onTab,
  sources,
}: {
  tab: DeskTab;
  onTab: (tab: DeskTab) => void;
  sources: RefObject<SourcesKeys | null>;
}) {
  const latest = useRef({ tab, onTab });
  useLayoutEffect(() => {
    latest.current = { tab, onTab };
  });

  useEffect(
    () =>
      listenForShortcuts((event) => {
        const { tab: current, onTab: switchTab } = latest.current;
        const target = event.target instanceof Element ? event.target : null;
        const keys = current === 'sources' ? sources.current : null;
        const row = keys?.rowAt(target) ?? null;
        const command = resolveDeskKey({
          key: event.key,
          modified: hasModifier(event),
          typing: isTypingTarget(target),
          inOverlay: isInOverlay(target),
          sources: keys?.state ?? null,
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
    [sources],
  );
}
