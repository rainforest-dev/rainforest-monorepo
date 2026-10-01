import {
  hasModifier,
  isTypingTarget,
  listenForShortcuts,
} from '@rainforest-dev/rainforest-ui/interaction';

import { placeOf, resolveShortcut, type Shortcut } from '@/lib';
import {
  isOverlayOpen,
  moveInGrid,
  openPreview,
  setStop,
  stepDay,
} from '@/lib/client';

import { closePreview } from './previews.ts';

const CELL = '[data-grid] a[data-date]';

const emit = (
  type:
    'memories:open-jump' | 'memories:open-shortcuts' | 'memories:focus-note',
) => document.dispatchEvent(new CustomEvent(type));

function run(action: Shortcut) {
  switch (action.type) {
    case 'navigate':
      return location.assign(action.href);
    case 'step-day':
      return stepDay(action.delta);
    case 'grid':
      return moveInGrid(action.key);
    case 'close-preview':
      return closePreview();
    case 'blur':
      return (document.activeElement as HTMLElement | null)?.blur();
    case 'focus-note':
      return emit('memories:focus-note');
    case 'open-jump':
      return emit('memories:open-jump');
    case 'open-shortcuts':
      return emit('memories:open-shortcuts');
  }
}

export function startShortcuts() {
  // Capture phase (the default): Base UI closes an overlay on Escape before a bubbling listener would run.
  listenForShortcuts((event) => {
    const active = document.activeElement;
    const action = resolveShortcut({
      key: event.key,
      modified: hasModifier(event),
      typing: isTypingTarget(active),
      overlayOpen: isOverlayOpen(),
      previewOpen: !!openPreview(),
      onCell: !!active?.matches(CELL),
      place: placeOf(location.pathname),
    });
    if (!action) return;
    event.preventDefault();
    run(action);
  });
  document.addEventListener('focusin', (event) => {
    if (event.target instanceof HTMLElement && event.target.matches(CELL))
      setStop(event.target);
  });
}
