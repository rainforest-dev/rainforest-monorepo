import { isOverlayOpen } from '../lib/client/overlays.ts';
import { openPreview } from '../lib/client/preview-dom.ts';
import { moveInGrid, setStop } from '../lib/client/roving.ts';
import { stepDay } from '../lib/client/step-day.ts';
import { placeOf } from '../lib/nav.ts';
import { resolveShortcut, type Shortcut } from '../lib/shortcuts.ts';

const TYPING =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
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
      return openPreview()?.hidePopover();
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
  window.addEventListener(
    'keydown',
    (event) => {
      const active = document.activeElement;
      const action = resolveShortcut({
        key: event.key,
        modified: event.metaKey || event.ctrlKey || event.altKey,
        typing:
          !!active?.closest(TYPING) ||
          event.isComposing ||
          event.keyCode === 229,
        overlayOpen: isOverlayOpen(),
        previewOpen: !!openPreview(),
        onCell: !!active?.matches(CELL),
        place: placeOf(location.pathname),
      });
      if (!action) return;
      event.preventDefault();
      run(action);
    },
    // Capture phase: Base UI closes an overlay on Escape before a bubbling listener would run.
    true,
  );
  document.addEventListener('focusin', (event) => {
    if (event.target instanceof HTMLElement && event.target.matches(CELL))
      setStop(event.target);
  });
}
