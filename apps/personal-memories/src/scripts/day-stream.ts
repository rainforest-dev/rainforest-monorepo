import type { AnnotateDetail } from '../lib/client/events.ts';
import { isOverlayOpen } from '../lib/client/overlays.ts';
import {
  distance,
  isZoomOutPinch,
  LONG_PRESS_MS,
  movedBeyond,
  pinchRatio,
  type Point,
} from '../lib/gestures.ts';
import {
  DATA_LIGHTBOX_READY,
  itemFromDataset,
  type LightboxItem,
} from '../lib/lightbox.ts';
import { placeOf, zoomOutHref } from '../lib/nav.ts';
import { taipeiHour } from '../lib/weeks.ts';

const RETRY_DELAY_MS = 2000;
const UNZOOMED_SCALE = 1.01;
const WINDOW_RADIUS = 7;
const RESTORE_MARGIN_VIEWPORTS = 2;

function notifyDayRestored(date: string) {
  document.dispatchEvent(
    new CustomEvent('memories:day-restored', { detail: { date } }),
  );
}

function compensateScroll(delta: number) {
  if (delta === 0) return;
  window.scrollBy(0, delta);
}

type DayFetchResult =
  | { status: 'ok'; section: HTMLElement }
  | { status: 'not-found' }
  | { status: 'error' };

async function fetchDay(date: string): Promise<DayFetchResult> {
  try {
    const response = await fetch(`/day/${date}/partial`);
    if (response.status === 404) return { status: 'not-found' };
    if (!response.ok) return { status: 'error' };
    const template = document.createElement('template');
    template.innerHTML = await response.text();
    const section = template.content.querySelector<HTMLElement>('[data-day]');
    return section ? { status: 'ok', section } : { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}

function watchLoaders(
  stream: HTMLElement,
  onDay: (el: HTMLElement) => void,
  windowManager: WindowManager,
) {
  const loading = new WeakSet<Element>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        const sentinel = target as HTMLElement;
        const date = sentinel.dataset['date'];
        if (!isIntersecting || !date || loading.has(sentinel)) continue;
        loading.add(sentinel);
        if (sentinel.dataset['state'] !== 'error')
          sentinel.dataset['state'] = 'loading';
        void fetchDay(date).then((result) => {
          loading.delete(sentinel);
          if (result.status === 'error') sentinel.dataset['state'] = 'error';
          else delete sentinel.dataset['state'];
          if (result.status === 'not-found') {
            delete sentinel.dataset['date'];
            observer.unobserve(sentinel);
            return;
          }
          if (result.status === 'error') {
            observer.unobserve(sentinel);
            window.addEventListener(
              'scroll',
              () => observer.observe(sentinel),
              {
                once: true,
                passive: true,
              },
            );
            return;
          }
          const { section } = result;
          const direction = sentinel.dataset['load'];
          if (direction === 'prev') {
            compensateSwap(stream, section, () => {
              sentinel.after(section);
              windowManager.track(section);
            });
            sentinel.dataset['date'] = section.dataset['prev'] ?? '';
          } else {
            sentinel.before(section);
            windowManager.track(section);
            sentinel.dataset['date'] = section.dataset['next'] ?? '';
          }
          onDay(section);
          notifyDayRestored(date);
          if (sentinel.dataset['date']) {
            // Re-observe: IntersectionObserver only fires on crossings, so a sentinel still in range needs a fresh entry to keep loading.
            observer.unobserve(sentinel);
            observer.observe(sentinel);
          } else {
            observer.unobserve(sentinel);
          }
        });
      }
    },
    { rootMargin: '200px 0px' },
  );
  stream.querySelectorAll<HTMLElement>('[data-load]').forEach((s) => {
    if (s.dataset['date']) observer.observe(s);
  });
}

function dayDateOf(el: HTMLElement): string | undefined {
  return el.dataset['day'] ?? el.dataset['dayPlaceholder'];
}

function dayNodesOf(stream: HTMLElement): HTMLElement[] {
  return [
    ...stream.querySelectorAll<HTMLElement>(
      '[data-day], [data-day-placeholder]',
    ),
  ];
}

function activeDayOf(nodes: readonly HTMLElement[]): string | undefined {
  if (!nodes.length) return undefined;
  const last = nodes[nodes.length - 1];
  const atBottom =
    last.getBoundingClientRect().bottom <= window.innerHeight + 4;
  if (atBottom) return dayDateOf(last);
  const threshold = window.innerHeight * 0.4;
  let current = nodes[0];
  for (const node of nodes) {
    if (node.getBoundingClientRect().top > threshold) break;
    current = node;
  }
  return dayDateOf(current);
}

type WindowManager = {
  manage(nodes: readonly HTMLElement[], activeDate: string): void;
  track(section: HTMLElement): void;
};

// content-visibility:auto reports the contain-intrinsic-size fallback, not real height, while skipped off-screen.
function measureRealHeight(section: HTMLElement): number {
  const previousVisibility = section.style.contentVisibility;
  section.style.contentVisibility = 'visible';
  const height = section.getBoundingClientRect().height;
  section.style.contentVisibility = previousVisibility;
  return height;
}

function findVisibleAnchor(
  stream: HTMLElement,
  exclude: HTMLElement,
): HTMLElement | undefined {
  return dayNodesOf(stream).find(
    (node) => node !== exclude && node.getBoundingClientRect().bottom > 0,
  );
}

function compensateSwap(
  stream: HTMLElement,
  exclude: HTMLElement,
  perform: () => void,
) {
  const anchor = findVisibleAnchor(stream, exclude);
  const before = anchor?.getBoundingClientRect().top;
  perform();
  if (anchor && before !== undefined)
    compensateScroll(anchor.getBoundingClientRect().top - before);
}

function createWindowManager(stream: HTMLElement): WindowManager {
  const restoring = new WeakSet<HTMLElement>();
  const retired = new WeakSet<HTMLElement>();
  const liveHeight = new WeakMap<HTMLElement, number>();
  // ResizeObserver.observe() always echoes one initial callback that isn't a real change.
  const settled = new WeakSet<HTMLElement>();
  let activeDate = '';

  // Safari has no scroll anchoring, so the stream opts out of Chrome's too (overflow-anchor: none) and every above-viewport resize is compensated here.
  const heightObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const section = entry.target as HTMLElement;
      const rect = section.getBoundingClientRect();
      section.style.containIntrinsicSize = `auto ${rect.height}px`;
      if (!settled.has(section)) {
        settled.add(section);
        liveHeight.set(section, rect.height);
        continue;
      }
      const previous = liveHeight.get(section) ?? rect.height;
      liveHeight.set(section, rect.height);
      const delta = rect.height - previous;
      if (delta !== 0 && rect.top + previous <= 0) compensateScroll(delta);
    }
  });

  const track = (section: HTMLElement) => {
    const height = measureRealHeight(section);
    liveHeight.set(section, height);
    settled.delete(section);
    section.style.containIntrinsicSize = `auto ${height}px`;
    heightObserver.observe(section);
  };

  const untrack = (section: HTMLElement) => {
    heightObserver.unobserve(section);
    liveHeight.delete(section);
    settled.delete(section);
  };

  const withinWindow = (el: HTMLElement) => {
    const nodes = dayNodesOf(stream);
    const activeIndex = nodes.findIndex((n) => dayDateOf(n) === activeDate);
    const index = nodes.indexOf(el);
    return (
      activeIndex >= 0 &&
      index >= 0 &&
      Math.abs(index - activeIndex) <= WINDOW_RADIUS
    );
  };

  const restore = (placeholder: HTMLElement, date: string) => {
    if (retired.has(placeholder) || restoring.has(placeholder)) return;
    restoring.add(placeholder);
    void fetchDay(date).then((result) => {
      restoring.delete(placeholder);
      if (!placeholder.isConnected || !withinWindow(placeholder)) return;
      if (result.status === 'not-found') {
        retired.add(placeholder);
        return;
      }
      if (result.status === 'error') {
        setTimeout(() => {
          if (!placeholder.isConnected || !withinWindow(placeholder)) return;
          restore(placeholder, date);
        }, RETRY_DELAY_MS);
        return;
      }
      const { section } = result;
      const placeholderHeight = parseFloat(placeholder.style.height);
      if (!Number.isNaN(placeholderHeight))
        section.style.containIntrinsicSize = `auto ${placeholderHeight}px`;
      compensateSwap(stream, placeholder, () => {
        placeholder.replaceWith(section);
        track(section);
      });
      notifyDayRestored(date);
    });
  };

  const collapse = (section: HTMLElement, date: string) => {
    untrack(section);
    const height = measureRealHeight(section);
    const placeholder = document.createElement('div');
    placeholder.dataset['dayPlaceholder'] = date;
    placeholder.className = section.className;
    placeholder.style.height = `${height}px`;
    compensateSwap(stream, section, () => {
      section.replaceWith(placeholder);
    });
  };

  return {
    track,
    manage(nodes, date) {
      activeDate = date;
      const activeIndex = nodes.findIndex((el) => dayDateOf(el) === date);
      if (activeIndex < 0) return;
      const margin = window.innerHeight * RESTORE_MARGIN_VIEWPORTS;
      nodes.forEach((el, index) => {
        const day = dayDateOf(el);
        if (!day) return;
        const distance = Math.abs(index - activeIndex);
        if (el.dataset['dayPlaceholder'] !== undefined) {
          if (retired.has(el) || distance > WINDOW_RADIUS) return;
          const rect = el.getBoundingClientRect();
          const near =
            rect.bottom > -margin && rect.top < window.innerHeight + margin;
          if (near) restore(el, day);
          return;
        }
        if (distance > WINDOW_RADIUS && !el.contains(document.activeElement))
          collapse(el, day);
      });
    },
  };
}

function markHour(stream: HTMLElement, date: string) {
  const section = stream.querySelector<HTMLElement>(`[data-day="${date}"]`);
  const strip = section?.querySelector('[data-hour-strip]');
  if (!section || !strip) return;
  const threshold = window.innerHeight * 0.4;
  let at: string | undefined;
  for (const row of section.querySelectorAll<HTMLElement>('[data-event-id]')) {
    if (!row.checkVisibility()) continue;
    if (row.getBoundingClientRect().top > threshold) break;
    at = row.dataset['at'];
  }
  const hour = at === undefined ? undefined : taipeiHour(at);
  for (const link of strip.querySelectorAll<HTMLElement>('[data-hour]')) {
    if (Number(link.dataset['hour']) === hour)
      link.setAttribute('aria-current', 'time');
    else link.removeAttribute('aria-current');
  }
}

function watchActiveDay(stream: HTMLElement, windowManager: WindowManager) {
  let active = '';
  let queued = false;

  const apply = () => {
    queued = false;
    const nodes = dayNodesOf(stream);
    const date = activeDayOf(nodes);
    if (date) {
      windowManager.manage(nodes, date);
      markHour(stream, date);
    }
    if (!date || date === active) return;
    active = date;
    history.replaceState(history.state, '', `/day/${date}${location.hash}`);
    document.title = `${date} · Memories`;
    document.dispatchEvent(
      new CustomEvent('memories:day', { detail: { date } }),
    );
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  };

  window.addEventListener('scroll', schedule, { passive: true });
  schedule();
  return schedule;
}

function watchAnnotate(stream: HTMLElement) {
  stream.addEventListener('click', (event) => {
    const button = (event.target as Element).closest('[data-annotate]');
    const item = button?.closest<HTMLElement>('[data-event-id]');
    if (!item) return;
    const {
      eventId = '',
      at = '',
      source = '',
      author = '',
      excerpt = '',
    } = item.dataset;
    const detail: AnnotateDetail = { eventId, at, source, author, excerpt };
    document.dispatchEvent(new CustomEvent('memories:annotate', { detail }));
  });
}

function watchLightbox(stream: HTMLElement) {
  stream.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    if (!document.documentElement.hasAttribute(DATA_LIGHTBOX_READY)) return;
    const link = (event.target as Element).closest<HTMLElement>(
      'a[data-lightbox]',
    );
    const tile = link?.closest<HTMLElement>('li[data-event-id]');
    const burst = tile?.closest<HTMLElement>('[data-burst]');
    const section = tile?.closest<HTMLElement>('[data-day]');
    const date = section?.dataset['day'];
    if (!link || !tile || !burst || !date) return;
    const tiles = [
      ...burst.querySelectorAll<HTMLElement>(':scope > li[data-event-id]'),
    ];
    const items = tiles
      .map((t) => itemFromDataset(t.dataset))
      .filter((i): i is LightboxItem => i !== undefined);
    event.preventDefault();
    document.dispatchEvent(
      new CustomEvent('memories:lightbox', {
        detail: {
          date,
          items,
          index: Math.max(0, tiles.indexOf(tile)),
          autoCover: section?.dataset['autoCover'],
          trigger: link,
        },
      }),
    );
  });
}

function watchLongPress(stream: HTMLElement) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let start: Point | undefined;
  let fire: (() => void) | undefined;
  let fired = false;
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    start = undefined;
    fire = undefined;
  };
  stream.addEventListener('pointerdown', (e) => {
    fired = false;
    cancel();
    if (e.pointerType !== 'touch' || !e.isPrimary || isOverlayOpen()) return;
    const row = (e.target as Element).closest<HTMLElement>('li[data-event-id]');
    if (!row) return;
    const at = { x: e.clientX, y: e.clientY };
    start = at;
    fire = () => {
      cancel();
      if (isOverlayOpen() || !row.isConnected) return;
      fired = true;
      const {
        eventId = '',
        at: time = '',
        source = '',
        author = '',
        excerpt = '',
      } = row.dataset;
      document.dispatchEvent(
        new CustomEvent('memories:longpress', {
          detail: {
            ...at,
            anchor: { eventId, at: time, source, author, excerpt },
            text: row.querySelector('p')?.textContent ?? excerpt,
          },
        }),
      );
    };
    timer = setTimeout(() => fire?.(), LONG_PRESS_MS);
  });
  stream.addEventListener('pointermove', (e) => {
    if (
      e.isPrimary &&
      start &&
      movedBeyond(start, { x: e.clientX, y: e.clientY })
    )
      cancel();
  });
  stream.addEventListener('pointerup', cancel);
  stream.addEventListener('pointercancel', cancel);
  // The compatibility mousedown a released touch emits would close the menu as an outside press.
  stream.addEventListener('touchend', (e) => {
    if (!fired) return;
    if (e.cancelable) e.preventDefault();
    setTimeout(() => {
      fired = false;
    });
  });
  stream.addEventListener('keydown', () => (fired = false), true);
  stream.addEventListener(
    'click',
    (e) => {
      if (!fired) return;
      fired = false;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
  stream.addEventListener('contextmenu', (e) => {
    fire?.();
    if (fired) e.preventDefault();
  });
}

function watchPinch(stream: HTMLElement) {
  let startDistance = 0;
  let lastDistance = 0;
  const spread = (t: TouchList) =>
    distance(
      { x: t[0].clientX, y: t[0].clientY },
      { x: t[1].clientX, y: t[1].clientY },
    );
  const unzoomed = () => (window.visualViewport?.scale ?? 1) <= UNZOOMED_SCALE;
  const reset = () => {
    startDistance = lastDistance = 0;
  };
  stream.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length === 2 && unzoomed() && !isOverlayOpen())
        startDistance = lastDistance = spread(e.touches);
      else reset();
    },
    { passive: true },
  );
  stream.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length === 2 && startDistance)
        lastDistance = spread(e.touches);
    },
    { passive: true },
  );
  stream.addEventListener('touchcancel', reset, { passive: true });
  stream.addEventListener(
    'touchend',
    () => {
      if (!startDistance) return;
      const ratio = pinchRatio(startDistance, lastDistance);
      reset();
      if (!isZoomOutPinch(ratio) || isOverlayOpen()) return;
      const place = placeOf(location.pathname);
      const href = place && zoomOutHref(place);
      if (href) location.assign(href);
    },
    { passive: true },
  );
}

export function startDayStream() {
  const stream = document.querySelector<HTMLElement>('[data-stream]');
  if (!stream) return;
  const windowManager = createWindowManager(stream);
  stream
    .querySelectorAll<HTMLElement>('[data-day]')
    .forEach((section) => windowManager.track(section));
  const notifyDay = watchActiveDay(stream, windowManager);
  watchLoaders(stream, notifyDay, windowManager);
  watchAnnotate(stream);
  watchLightbox(stream);
  watchLongPress(stream);
  watchPinch(stream);
}
