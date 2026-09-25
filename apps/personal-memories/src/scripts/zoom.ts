import { placeOf } from '../lib/nav.ts';
import { morphKey } from '../lib/zoom.ts';

const REDUCE = '(prefers-reduced-motion: reduce)';

const firstVisible = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].find((el) =>
    el.checkVisibility(),
  );

export function startZoom() {
  window.addEventListener('pageswap', (event) => {
    const to = event.activation?.entry.url;
    if (!event.viewTransition || !to || matchMedia(REDUCE).matches) return;
    const key = morphKey(
      placeOf(location.pathname),
      placeOf(new URL(to).pathname),
    );
    const el = key ? firstVisible(`[data-morph="${key}"]`) : undefined;
    if (key && el) el.style.viewTransitionName = key;
  });
  firstVisible('[data-morph-target]')?.focus({ preventScroll: true });
}
