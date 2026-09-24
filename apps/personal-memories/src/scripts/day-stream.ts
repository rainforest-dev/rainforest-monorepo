const HIDDEN_KEY = 'memories:hidden-sources';

type AnnotateDetail = {
  eventId: string;
  at: string;
  source: string;
  author: string;
  excerpt: string;
};

declare global {
  interface DocumentEventMap {
    'memories:day': CustomEvent<{ date: string }>;
    'memories:day-restored': CustomEvent<{ date: string }>;
    'memories:annotate': CustomEvent<AnnotateDetail>;
  }
}

const RETRY_DELAY_MS = 2000;
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
        void fetchDay(date).then((result) => {
          loading.delete(sentinel);
          if (result.status === 'not-found') {
            delete sentinel.dataset['date'];
            observer.unobserve(sentinel);
            return;
          }
          if (result.status === 'error') {
            observer.unobserve(sentinel);
            setTimeout(() => observer.observe(sentinel), RETRY_DELAY_MS);
            return;
          }
          const { section } = result;
          const direction = sentinel.dataset['load'];
          if (direction === 'prev') {
            const before = document.documentElement.scrollHeight;
            sentinel.after(section);
            windowManager.track(section);
            compensateScroll(document.documentElement.scrollHeight - before);
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

function createWindowManager(stream: HTMLElement): WindowManager {
  const restoring = new WeakSet<HTMLElement>();
  const retired = new WeakSet<HTMLElement>();
  const liveHeight = new WeakMap<HTMLElement, number>();
  // ResizeObserver.observe() always echoes one initial callback that isn't a real change.
  const settled = new WeakSet<HTMLElement>();
  let activeDate = '';

  // Safari has no scroll anchoring, so an above-viewport resize needs manual scrollY compensation.
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
      if (delta !== 0 && rect.bottom <= 0) compensateScroll(delta);
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
      const rect = placeholder.getBoundingClientRect();
      const above = rect.top < 0;
      const before = document.documentElement.scrollHeight;
      placeholder.replaceWith(section);
      track(section);
      if (above)
        compensateScroll(document.documentElement.scrollHeight - before);
      notifyDayRestored(date);
    });
  };

  const collapse = (section: HTMLElement, date: string) => {
    untrack(section);
    const height = measureRealHeight(section);
    const rect = section.getBoundingClientRect();
    const placeholder = document.createElement('div');
    placeholder.dataset['dayPlaceholder'] = date;
    placeholder.className = section.className;
    placeholder.style.height = `${height}px`;
    const above = rect.top < 0;
    const before = document.documentElement.scrollHeight;
    section.replaceWith(placeholder);
    if (above) compensateScroll(document.documentElement.scrollHeight - before);
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
        if (distance > WINDOW_RADIUS) collapse(el, day);
      });
    },
  };
}

function watchActiveDay(stream: HTMLElement, windowManager: WindowManager) {
  let active = '';
  let queued = false;

  const apply = () => {
    queued = false;
    const nodes = dayNodesOf(stream);
    const date = activeDayOf(nodes);
    if (date) windowManager.manage(nodes, date);
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

function watchFilter(stream: HTMLElement) {
  const filter = stream.querySelector('[data-source-filter]');
  if (!filter) return;
  const boxes = [
    ...filter.querySelectorAll<HTMLInputElement>('input[type=checkbox]'),
  ];
  const read = (): string[] => {
    try {
      const value = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  const apply = () => {
    for (const box of boxes)
      stream.toggleAttribute(`data-hide-${box.value}`, !box.checked);
  };
  const hidden = new Set(read());
  boxes.forEach((box) => (box.checked = !hidden.has(box.value)));
  apply();
  filter.addEventListener('change', () => {
    apply();
    try {
      localStorage.setItem(
        HIDDEN_KEY,
        JSON.stringify(boxes.filter((b) => !b.checked).map((b) => b.value)),
      );
    } catch {
      return;
    }
  });
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
    document.dispatchEvent(
      new CustomEvent('memories:annotate', {
        detail: { eventId, at, source, author, excerpt },
      }),
    );
  });
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
  watchFilter(stream);
  watchAnnotate(stream);
}
