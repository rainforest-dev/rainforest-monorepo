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

async function fetchDay(date: string): Promise<HTMLElement | undefined> {
  const response = await fetch(`/day/${date}/partial`);
  if (!response.ok) return undefined;
  const template = document.createElement('template');
  template.innerHTML = await response.text();
  return template.content.querySelector<HTMLElement>('[data-day]') ?? undefined;
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
        void fetchDay(date).then((section) => {
          loading.delete(sentinel);
          if (!section) {
            delete sentinel.dataset['date'];
            observer.unobserve(sentinel);
            return;
          }
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

function activeDayOf(sections: readonly HTMLElement[]): string | undefined {
  if (!sections.length) return undefined;
  const atBottom =
    window.scrollY + window.innerHeight >=
    document.documentElement.scrollHeight - 4;
  // A short final section may never cross the 40% line — there's no more content below it to scroll past — so max scroll always activates the last day.
  if (atBottom) return sections[sections.length - 1]?.dataset['day'];
  const threshold = window.innerHeight * 0.4;
  let current = sections[0];
  for (const section of sections) {
    if (section.getBoundingClientRect().top > threshold) break;
    current = section;
  }
  return current.dataset['day'];
}

function watchActiveDay(stream: HTMLElement) {
  let active = '';
  let queued = false;

  const apply = () => {
    queued = false;
    const sections = [...stream.querySelectorAll<HTMLElement>('[data-day]')];
    const date = activeDayOf(sections);
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
    localStorage.setItem(
      HIDDEN_KEY,
      JSON.stringify(boxes.filter((b) => !b.checked).map((b) => b.value)),
    );
    apply();
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
