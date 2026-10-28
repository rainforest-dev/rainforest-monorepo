'use client';

import {
  type CollectionId,
  collectionLabel,
  getCollection,
} from '@rainforest-dev/library-contract';
import { cn } from '@rainforest-dev/rainforest-react';
import { ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

import { COLLECTION_ICONS, type RenderShellLink } from './collection-nav';
import { useLibraryLocale, useLibraryT } from './i18n-provider';

export interface Crumb {
  label: string;
  href: string;
}

export interface LibraryBreadcrumbProps {
  /** The collection the page belongs to: the first crumb, linking to its front page. */
  current: CollectionId;
  /** Steps between the collection and the page, such as a knowledge-base shelf. */
  trail?: readonly Crumb[];
  /** The page itself, the last crumb, not a link. */
  page: string;
  /** Renders the links with the app's router; plain anchors by default. */
  renderLink?: RenderShellLink;
  className?: string;
}

const LINK = 'hover:text-foreground flex min-w-0 items-center gap-1.5';

/**
 * Where a detail page sits, at the top of the page: collection › … › page. Every detail page
 * shows one, so the way back up never depends on the browser's back button.
 */
export function LibraryBreadcrumb({
  current,
  trail = [],
  page,
  renderLink,
  className,
}: LibraryBreadcrumbProps) {
  const t = useLibraryT();
  const locale = useLibraryLocale();
  const collection = getCollection(current);
  const Icon = COLLECTION_ICONS[current];
  const link = (href: string, children: ReactNode) =>
    renderLink ? (
      renderLink({ href, className: LINK, children }, collection)
    ) : (
      <a href={href} className={LINK}>
        {children}
      </a>
    );
  const steps: Crumb[] = [
    { label: collectionLabel(collection, locale), href: collection.basePath },
    ...trail,
  ];
  return (
    <nav aria-label={t('breadcrumb')} className={cn('min-w-0', className)}>
      <ol className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
        {steps.map((step, i) => (
          <Fragment key={step.href}>
            <li className="flex shrink-0 items-center">
              {link(
                step.href,
                <>
                  {i === 0 && <Icon className="size-4" aria-hidden />}
                  {step.label}
                </>,
              )}
            </li>
            <li aria-hidden className="flex shrink-0 items-center">
              <ChevronRight className="size-4" />
            </li>
          </Fragment>
        ))}
        <li
          aria-current="page"
          className="text-foreground min-w-0 truncate font-medium"
        >
          {page}
        </li>
      </ol>
    </nav>
  );
}
