'use client';

import {
  type Collection,
  type CollectionId,
  collectionLabel,
  COLLECTIONS,
} from '@rainforest-dev/library-contract';
import { cn } from '@rainforest-dev/rainforest-react';
import {
  BookImage,
  BookOpen,
  Landmark,
  LibraryBig,
  type LucideIcon,
  Newspaper,
  NotebookPen,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

import { useLibraryLocale, useLibraryT } from './i18n-provider';
import { SHELL_TRANSITION_NAMES } from './ids';
import { returnPoint } from './shared-state';

export const COLLECTION_ICONS: Record<CollectionId, LucideIcon> = {
  hall: Landmark,
  books: BookOpen,
  notebooks: NotebookPen,
  rack: Newspaper,
  magazines: BookImage,
  kb: LibraryBig,
};

export interface ShellLinkProps {
  href: string;
  className: string;
  'aria-current'?: 'page';
  children: ReactNode;
}

/**
 * Renders a collection link. The default is a plain `<a>`: links between apps must be full
 * page loads. An app may return its router's link for its own collections.
 */
export type RenderShellLink = (
  props: ShellLinkProps,
  collection: Collection,
) => ReactNode;

const renderAnchor: RenderShellLink = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

interface NavProps {
  current: CollectionId;
  /** Which collections to show, in order. Defaults to all of them. */
  collections?: readonly CollectionId[];
  renderLink?: RenderShellLink;
  className?: string;
  /** The nav's accessible name; the shell's "Collections" in the page's locale by default. */
  label?: string;
  /** Link each other collection to where this tab last left it, instead of its root. */
  resume?: boolean;
}

/**
 * Each collection's href. Return points live in sessionStorage, which the server cannot read,
 * so they are swapped in after hydration.
 */
function useHrefs(
  collections: Collection[],
  current: CollectionId,
  resume: boolean,
): Record<string, string> {
  const roots = Object.fromEntries(collections.map((c) => [c.id, c.basePath]));
  const [hrefs, setHrefs] = useState(roots);
  const key = collections.map((c) => c.id).join();
  useEffect(() => {
    if (!resume) return;
    setHrefs(
      Object.fromEntries(
        collections.map((c) => [
          c.id,
          c.id === current ? c.basePath : (returnPoint(c.id) ?? c.basePath),
        ]),
      ),
    );
    // `collections` is rebuilt every render; `key` names its contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, current, resume]);
  return hrefs;
}

function pick(ids: readonly CollectionId[] | undefined): Collection[] {
  if (!ids) return [...COLLECTIONS];
  return ids.flatMap((id) => COLLECTIONS.filter((c) => c.id === id));
}

/** The collection switcher inside the top bar, from tablet width up. */
export function CollectionNav({
  current,
  collections,
  renderLink = renderAnchor,
  className,
  label,
  resume = false,
}: NavProps) {
  const shown = pick(collections);
  const hrefs = useHrefs(shown, current, resume);
  const locale = useLibraryLocale();
  const t = useLibraryT();
  return (
    <nav
      aria-label={label ?? t('collections')}
      className={cn('hidden items-center gap-1 sm:flex', className)}
    >
      {shown.map((collection) => {
        const active = collection.id === current;
        return (
          <span key={collection.id} className="contents">
            {renderLink(
              {
                href: hrefs[collection.id] ?? collection.basePath,
                'aria-current': active ? 'page' : undefined,
                className: cn(
                  'text-foreground hover:bg-accent rounded-md px-3 py-1.5 text-sm',
                  active && 'bg-accent font-semibold',
                ),
                children: collectionLabel(collection, locale),
              },
              collection,
            )}
          </span>
        );
      })}
    </nav>
  );
}

/** The phone's bottom tab bar: one 64px row of icon-and-label tabs, below `sm`. */
export function CollectionTabBar({
  current,
  collections,
  renderLink = renderAnchor,
  className,
  label,
  resume = false,
}: NavProps) {
  const shown = pick(collections);
  const hrefs = useHrefs(shown, current, resume);
  const locale = useLibraryLocale();
  const t = useLibraryT();
  return (
    <nav
      aria-label={label ?? t('collections')}
      className={cn(
        'bg-background fixed inset-x-0 bottom-0 z-30 flex h-16 border-t pb-[env(safe-area-inset-bottom)] sm:hidden',
        className,
      )}
      style={{ viewTransitionName: SHELL_TRANSITION_NAMES.tabBar }}
    >
      {shown.map((collection) => {
        const active = collection.id === current;
        const Icon = COLLECTION_ICONS[collection.id];
        return (
          <span key={collection.id} className="contents">
            {renderLink(
              {
                href: hrefs[collection.id] ?? collection.basePath,
                'aria-current': active ? 'page' : undefined,
                className: cn(
                  'flex min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs',
                  active
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground',
                ),
                children: (
                  <>
                    <Icon className="size-5" aria-hidden />
                    {collectionLabel(collection, locale)}
                  </>
                ),
              },
              collection,
            )}
          </span>
        );
      })}
    </nav>
  );
}
