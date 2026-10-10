import { asLinkPreview, type LinkPreview, previewUrl } from '@/lib';

const SLOT = '[data-link-preview]';
const CARD =
  'bg-muted/50 border-border hover:bg-muted focus-visible:ring-ring mt-1.5 flex max-w-md items-stretch gap-3 overflow-hidden rounded-md border p-2.5 outline-none transition-colors focus-visible:ring-2 motion-reduce:transition-none';

const requests = new Map<string, Promise<LinkPreview | undefined>>();

function load(href: string): Promise<LinkPreview | undefined> {
  let request = requests.get(href);
  if (!request) {
    request = fetch(previewUrl(href))
      .then((response) => (response.ok ? response.json() : undefined))
      .then(asLinkPreview)
      .catch(() => undefined);
    requests.set(href, request);
  }
  return request;
}

function span(className: string, text: string) {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function card(href: string, preview: LinkPreview & { title: string }) {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = CARD;
  const text = document.createElement('span');
  text.className = 'flex min-w-0 flex-1 flex-col gap-0.5';
  text.append(
    span(
      'text-muted-foreground truncate text-xs',
      preview.siteName ?? hostOf(href),
    ),
    span('text-meta line-clamp-2 font-semibold break-words', preview.title),
  );
  if (preview.description)
    text.append(
      span(
        'text-muted-foreground line-clamp-2 text-xs break-words',
        preview.description,
      ),
    );
  link.append(text);
  if (preview.image) {
    const img = document.createElement('img');
    img.src = preview.image;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.className =
      'bg-muted size-16 shrink-0 self-center rounded-sm object-cover';
    img.addEventListener('error', () => img.remove(), { once: true });
    link.append(img);
  }
  return link;
}

async function fill(slot: HTMLElement) {
  const href = slot.dataset['linkPreview'];
  if (!href) return;
  const preview = await load(href);
  if (!preview?.title || !slot.isConnected) return;
  slot.replaceChildren(card(href, { ...preview, title: preview.title }));
  slot.hidden = false;
}

export type LinkPreviews = {
  observe(root: ParentNode): void;
  release(root: ParentNode): void;
};

export function createLinkPreviews(): LinkPreviews {
  const slots = new WeakMap<Element, HTMLElement>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        const slot = slots.get(target);
        if (!isIntersecting || !slot) continue;
        observer.unobserve(target);
        slots.delete(target);
        void fill(slot);
      }
    },
    { rootMargin: '300px 0px' },
  );
  // IntersectionObserver never reports a display:none target, so the hidden slot is watched through its visible parent.
  const anchorOf = (slot: HTMLElement) => slot.parentElement ?? slot;
  return {
    observe(root) {
      for (const slot of root.querySelectorAll<HTMLElement>(SLOT)) {
        if (!slot.hidden) continue;
        const anchor = anchorOf(slot);
        slots.set(anchor, slot);
        observer.observe(anchor);
      }
    },
    release(root) {
      for (const slot of root.querySelectorAll<HTMLElement>(SLOT)) {
        const anchor = anchorOf(slot);
        slots.delete(anchor);
        observer.unobserve(anchor);
      }
    },
  };
}
