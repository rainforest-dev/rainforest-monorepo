'use client';

import { cn } from '@rainforest-dev/rainforest-react';
import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';

import { type ShellLinkProps } from './collection-nav';

export interface SectionItem {
  id: string;
  label: string;
  /** A page of its own. Without one the item is a button that calls `onSelect`. */
  href?: string;
  icon?: LucideIcon;
  /** A fuller name for assistive tech, starting with the visible label. */
  ariaLabel?: string;
}

export interface SectionNavProps {
  /** The nav's accessible name, such as "Views" or "Sections". */
  label: string;
  items: readonly SectionItem[];
  /** The id of the item showing now; none is marked when nothing matches. */
  current?: string;
  /** For items without an `href`: a view the page switches to in place. */
  onSelect?: (id: string) => void;
  /** Renders link items with the app's router; plain anchors by default. */
  renderLink?: (props: ShellLinkProps) => ReactNode;
  /** The collection's own controls, at the row's end, such as a search within it. */
  children?: ReactNode;
  className?: string;
}

const ITEM =
  'focus-visible:outline-ring flex h-8 items-center gap-1.5 rounded-md px-3 text-sm outline-offset-1 focus-visible:outline-2';
const ACTIVE = 'bg-background font-semibold shadow-sm';
const IDLE = 'text-muted-foreground hover:text-foreground';

const renderAnchor = ({ children, ...props }: ShellLinkProps) => (
  <a {...props}>{children}</a>
);

/**
 * A collection's second level, in one place everywhere: the row right under the library bar.
 * From `lg` up it sticks below the bar, and `--library-top` grows by its height so sticky
 * columns start under it.
 */
export function SectionNav({
  label,
  items,
  current,
  onSelect,
  renderLink = renderAnchor,
  children,
  className,
}: SectionNavProps) {
  return (
    // A landmark of its own, so the collection's controls beside the nav are inside one.
    <div
      role="region"
      aria-label={label}
      data-section-nav
      className={cn(
        'bg-background z-25 relative flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2 lg:sticky lg:top-14 lg:h-12 lg:flex-nowrap lg:px-4 lg:py-0',
        className,
      )}
    >
      <nav
        aria-label={label}
        className="bg-muted flex w-fit shrink-0 gap-0.5 rounded-lg p-0.5"
      >
        {items.map(({ id, label: name, href, icon: Icon, ariaLabel }) => {
          const active = id === current;
          const content = (
            <>
              {Icon && <Icon className="size-4" aria-hidden />}
              {name}
            </>
          );
          return (
            <span key={id} className="contents">
              {href ? (
                renderLink({
                  href,
                  'aria-current': active ? 'page' : undefined,
                  'aria-label': ariaLabel,
                  className: cn(ITEM, active ? ACTIVE : IDLE),
                  children: content,
                })
              ) : (
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={ariaLabel}
                  onClick={() => onSelect?.(id)}
                  className={cn(ITEM, active ? ACTIVE : IDLE)}
                >
                  {content}
                </button>
              )}
            </span>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
