import { dayInUrl } from './day-url.ts';

export function stepDay(delta: -1 | 1) {
  const date = dayInUrl();
  const section = date
    ? document.querySelector<HTMLElement>(`[data-day="${date}"]`)
    : null;
  const target =
    delta > 0 ? section?.dataset['next'] : section?.dataset['prev'];
  if (target) location.assign(`/day/${target}`);
}
