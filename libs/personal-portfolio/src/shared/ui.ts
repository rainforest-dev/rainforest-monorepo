/**
 * Shared shadcn-aligned class helpers for the portfolio islands.
 *
 * Every island is a React component rendered inside apps/personal-website, whose
 * Tailwind build scans `libs/personal-portfolio/src` (app.css `@source`) and loads the
 * shadcn token plugin. Centralising the button / avatar / badge / field look here
 * keeps every island matching the app's shadcn components — the same focus ring,
 * transition, hover state, radius and icon sizing — instead of each island
 * hand-rolling slightly different classes (which is what left them looking
 * "not quite shadcn", with no focus rings and inconsistent icon sizes).
 *
 * Dependency-free by design: libs/personal-portfolio ships no cva/clsx, so this is a small
 * template-string joiner rather than a class-variance-authority config. Mirrors
 * apps/personal-website/src/components/ui/button/Button.vue.
 */

/** Join class fragments, dropping falsy ones (the local stand-in for clsx). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// Shared button base — the shadcn button contract: keyboard focus ring, colour
// transition, disabled affordance, and a uniform icon size for any inline glyph.
const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'disabled:pointer-events-none disabled:opacity-50 ' +
  '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0';

export type ButtonVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger';
export type ButtonSize = 'sm' | 'default' | 'icon';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline:
    'border border-border bg-transparent text-foreground hover:bg-muted hover:text-foreground',
  ghost: 'text-foreground hover:bg-muted hover:text-foreground',
  // Outline-destructive — the islands' danger action (Reject / Disconnect),
  // not shadcn's solid destructive fill.
  danger:
    'border border-destructive/50 text-destructive hover:bg-destructive/10',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3',
  default: 'h-10 px-4 py-2',
  icon: 'h-9 w-9',
};

/** shadcn button classes. `className` is appended last so callers can extend. */
export function button(
  opts: {
    variant?: ButtonVariant;
    size?: ButtonSize;
    className?: string;
  } = {},
): string {
  const { variant = 'default', size = 'default', className } = opts;
  return cx(
    BUTTON_BASE,
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}

/**
 * A segmented / toggle control (role switcher, tab, nav item). Bespoke active
 * state, but shares the focus ring + transition so it reads as one family with
 * `button()`. Colour is left to `className` since active styling varies.
 */
export function segment(
  active: boolean,
  className?: string,
): string {
  return cx(
    'inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium ' +
      'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
      '[&_svg]:size-4 [&_svg]:shrink-0',
    active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
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
