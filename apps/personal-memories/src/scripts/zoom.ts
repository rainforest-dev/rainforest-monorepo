import { setStop } from '../lib/client/roving.ts';
import { placeOf } from '../lib/nav.ts';
import { REVEAL_STYLE_ID, revealKey } from '../lib/reveal.ts';
import { morphKey } from '../lib/zoom.ts';

const REDUCE = '(prefers-reduced-motion: reduce)';
const MARKABLE = 'a[data-date], a[data-month-row]';

const firstVisible = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].find((el) =>
    el.checkVisibility(),
  );

function arrivalKey(): string | undefined {
  const activation =
    typeof navigation === 'undefined' ? null : navigation.activation;
  if (!activation) return firstVisible('[data-morph-target]')?.dataset['morph'];
  return revealKey(activation.from?.url ?? undefined, location.href, {
    placeOf,
    morphKey,
  });
}

function onScreen(el: HTMLElement) {
  const { top, bottom, left, right } = el.getBoundingClientRect();
  const inset =
    parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) ||
    0;
  return (
    top >= inset && bottom <= innerHeight && left >= 0 && right <= innerWidth
  );
}

function arrive(focus: (el: HTMLElement) => void) {
  for (const el of document.querySelectorAll('[data-last-viewed]')) {
    el.removeAttribute('data-last-viewed');
    el.removeAttribute('aria-description');
  }
  const key = arrivalKey();
  if (!key) return;
  const matches = [
    ...document.querySelectorAll<HTMLElement>(`[data-morph="${key}"]`),
  ];
  // A same-task remove-then-set can coalesce into a no-op on a repeat bfcache arrival; flush first so the flash restarts.
  if (matches.length && !matchMedia(REDUCE).matches)
    void document.documentElement.offsetWidth;
  for (const el of matches.filter((m) => m.matches(MARKABLE))) {
    el.setAttribute('data-last-viewed', '');
    el.setAttribute('aria-description', '上次看到');
    if (el.matches('a[data-date]')) setStop(el);
  }
  const target = matches.find((el) => el.checkVisibility());
  if (!target) return;
  focus(target);
  if (!onScreen(target)) target.scrollIntoView({ block: 'nearest' });
}

const focusOnly = (el: HTMLElement) => el.focus({ preventScroll: true });

export function startZoom(focus: (el: HTMLElement) => void = focusOnly) {
  window.addEventListener('pageswap', (event) => {
    document.getElementById(REVEAL_STYLE_ID)?.remove();
    const to = event.activation?.entry.url;
    if (!event.viewTransition || !to || matchMedia(REDUCE).matches) return;
    const key = morphKey(
      placeOf(location.pathname),
      placeOf(new URL(to).pathname),
    );
    const el = key ? firstVisible(`[data-morph="${key}"]`) : undefined;
    if (key && el) el.style.viewTransitionName = key;
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) arrive(focus);
  });
  arrive(focus);
}
