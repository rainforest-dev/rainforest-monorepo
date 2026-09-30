/** Join class fragments, dropping falsy ones (the local stand-in for clsx). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * A segmented / toggle control (role switcher, tab, nav item). Bespoke active
 * state, but shares the focus ring + transition so it reads as one family with
 * `buttonVariants()`. Colour is left to `className` since active styling varies.
 */
export function segment(active: boolean, className?: string): string {
  return cx(
    'inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium ' +
      'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
      '[&_svg]:size-4 [&_svg]:shrink-0',
    active
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:text-foreground',
    className,
  );
}

/** Letter/initial avatar — one fixed circle size so avatars line up everywhere. */
export function avatar(className?: string): string {
  return cx(
    'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
    className,
  );
}
