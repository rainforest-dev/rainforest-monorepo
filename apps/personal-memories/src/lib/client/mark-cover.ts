import { effectiveCover } from '@/lib/lightbox.ts';

export function markCover(date: string, cover: string | undefined) {
  const section = document.querySelector<HTMLElement>(
    `section[data-day="${CSS.escape(date)}"]`,
  );
  if (!section) return;
  const tile = (id: string) =>
    section.querySelector(`[data-event-id="${CSS.escape(id)}"]`);
  const id = effectiveCover({
    cover,
    coverOnDay: !!cover && !!tile(cover),
    autoCover: section.dataset['autoCover'],
  });
  for (const el of section.querySelectorAll('[data-cover]'))
    el.removeAttribute('data-cover');
  if (id) tile(id)?.setAttribute('data-cover', '');
}
