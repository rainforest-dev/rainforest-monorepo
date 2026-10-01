export const TYPING_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

export const OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [data-slot="select-content"], [data-slot="popover-content"]';

const closestMatch = (target: EventTarget | null, selector: string) =>
  target instanceof Element && target.closest(selector) !== null;

/** Whether the event target sits in a text field or editable region. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return closestMatch(target, TYPING_SELECTOR);
}

/** Whether the event target sits inside a dialog, menu or popover. */
export function isInOverlay(target: EventTarget | null): boolean {
  return closestMatch(target, OVERLAY_SELECTOR);
}

/** Whether the key event belongs to an IME composition. */
export function isComposing(event: KeyboardEvent): boolean {
  // Safari reports the composition-ending keydown with isComposing false but keyCode 229.
  return event.isComposing || event.keyCode === 229;
}

/** Whether Ctrl or Meta is held, and Alt too unless `alt` is false. */
export function hasModifier(
  event: KeyboardEvent,
  { alt = true }: { alt?: boolean } = {},
): boolean {
  return event.ctrlKey || event.metaKey || (alt && event.altKey);
}

/**
 * Calls `handler` for every keydown outside an IME composition, in the capture
 * phase on `window` by default. Returns the unsubscribe function.
 */
export function listenForShortcuts(
  handler: (event: KeyboardEvent) => void,
  {
    target = window,
    capture = true,
  }: { target?: Window | Document; capture?: boolean } = {},
): () => void {
  const listener = (event: Event) => {
    if (!(event instanceof KeyboardEvent) || isComposing(event)) return;
    handler(event);
  };
  target.addEventListener('keydown', listener, capture);
  return () => target.removeEventListener('keydown', listener, capture);
}
