import { placeOf } from './nav.ts';
import { morphKey } from './zoom.ts';

export const REVEAL_STYLE_ID = 'reveal-morph';

export type RevealDeps = {
  placeOf: typeof placeOf;
  morphKey: typeof morphKey;
};

type InstallDeps = RevealDeps & {
  id: string;
  revealKey: typeof revealKey;
  revealStyle: typeof revealStyle;
};

export function revealKey(
  from: string | undefined,
  here: string,
  deps: RevealDeps,
): string | undefined {
  if (!from) return undefined;
  try {
    const left = new URL(from);
    const landed = new URL(here);
    if (left.origin !== landed.origin) return undefined;
    return deps.morphKey(
      deps.placeOf(left.pathname),
      deps.placeOf(landed.pathname),
    );
  } catch {
    return undefined;
  }
}

export function revealStyle(key: string | undefined): string {
  const none = '[data-morph]{view-transition-name:none!important}';
  return key
    ? `${none}[data-morph="${key}"]{view-transition-name:${key}!important}`
    : none;
}

// pagereveal fires before deferred or module scripts can listen, so Layout inlines this as a blocking head script.
export function installReveal(deps: InstallDeps) {
  const clear = () => {
    document.getElementById(deps.id)?.remove();
    for (const el of document.querySelectorAll<HTMLElement>('[data-morph]'))
      el.style.viewTransitionName = '';
  };
  addEventListener('pagereveal', (event) => {
    const activation =
      typeof navigation === 'undefined' ? null : navigation.activation;
    if (
      activation &&
      event.viewTransition &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const style = document.createElement('style');
      style.id = deps.id;
      style.textContent = deps.revealStyle(
        deps.revealKey(activation.from?.url ?? undefined, location.href, deps),
      );
      document.head.append(style);
    }
    (event.viewTransition?.finished ?? Promise.resolve()).finally(() => {
      clear();
      if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', clear, { once: true });
    });
  });
  addEventListener('pageshow', (event) => {
    if (event.persisted) clear();
  });
}

export function revealScript(): string {
  const deps = [
    `id:${JSON.stringify(REVEAL_STYLE_ID)}`,
    `placeOf:${placeOf.toString()}`,
    `morphKey:${morphKey.toString()}`,
    `revealKey:${revealKey.toString()}`,
    `revealStyle:${revealStyle.toString()}`,
  ].join(',');
  return `(${installReveal.toString()})({${deps}});`;
}
