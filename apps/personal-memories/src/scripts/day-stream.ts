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
    'memories:annotate': CustomEvent<AnnotateDetail>;
  }
}

const RETRY_DELAY_MS = 2000;
const WINDOW_RADIUS = 7;
const RESTORE_MARGIN_VIEWPORTS = 2;

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

function watchLoaders(stream: HTMLElement, onDay: (el: HTMLElement) => void) {
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
            window.scrollBy(0, document.documentElement.scrollHeight - before);
            sentinel.dataset['date'] = section.dataset['prev'] ?? '';
          } else {
            sentinel.before(section);
            sentinel.dataset['date'] = section.dataset['next'] ?? '';
          }
          onDay(section);
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
  const atBottom =
    window.scrollY + window.innerHeight >=
    document.documentElement.scrollHeight - 4;
  if (atBottom) return dayDateOf(nodes[nodes.length - 1]);
  const threshold = window.innerHeight * 0.4;
  let current = nodes[0];
  for (const node of nodes) {
    if (node.getBoundingClientRect().top > threshold) break;
    current = node;
  }
  return dayDateOf(current);
}

function collapseToPlaceholder(section: HTMLElement, date: string) {
  const rect = section.getBoundingClientRect();
  const placeholder = document.createElement('div');
  placeholder.dataset['dayPlaceholder'] = date;
  placeholder.className = section.className;
  placeholder.style.height = `${rect.height}px`;
  const above = rect.top < 0;
  const before = document.documentElement.scrollHeight;
  section.replaceWith(placeholder);
  if (above) window.scrollBy(0, document.documentElement.scrollHeight - before);
}

function restoreFromPlaceholder(
  placeholder: HTMLElement,
  section: HTMLElement,
) {
  const rect = placeholder.getBoundingClientRect();
  const above = rect.top < 0;
  const before = document.documentElement.scrollHeight;
  placeholder.replaceWith(section);
  if (above) window.scrollBy(0, document.documentElement.scrollHeight - before);
}

function watchWindow() {
  const restoring = new WeakSet<HTMLElement>();

  const restore = (placeholder: HTMLElement, date: string) => {
    if (restoring.has(placeholder)) return;
    restoring.add(placeholder);
    void fetchDay(date).then((result) => {
      restoring.delete(placeholder);
      if (result.status === 'ok') {
        restoreFromPlaceholder(placeholder, result.section);
        return;
      }
      if (result.status === 'error')
        setTimeout(() => restore(placeholder, date), RETRY_DELAY_MS);
    });
  };

  return (nodes: readonly HTMLElement[], activeDate: string) => {
    const activeIndex = nodes.findIndex((el) => dayDateOf(el) === activeDate);
    if (activeIndex < 0) return;
    const margin = window.innerHeight * RESTORE_MARGIN_VIEWPORTS;
    nodes.forEach((el, index) => {
      const date = dayDateOf(el);
      if (!date) return;
      if (el.dataset['dayPlaceholder'] !== undefined) {
        const rect = el.getBoundingClientRect();
        const near =
          rect.bottom > -margin && rect.top < window.innerHeight + margin;
        if (near) restore(el, date);
        return;
      }
      if (Math.abs(index - activeIndex) > WINDOW_RADIUS)
        collapseToPlaceholder(el, date);
    });
  };
}

function watchActiveDay(stream: HTMLElement) {
  let active = '';
  let queued = false;
  const manageWindow = watchWindow();

  const apply = () => {
    queued = false;
    const nodes = dayNodesOf(stream);
    const date = activeDayOf(nodes);
    if (date) manageWindow(nodes, date);
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
  const notifyDay = watchActiveDay(stream);
  watchLoaders(stream, notifyDay);
  watchFilter(stream);
  watchAnnotate(stream);
}
