'use client';

import { Fragment } from 'react';

import {
  type Backlink,
  type NotebookIndex,
  pageNumberOf,
  pageSegments,
} from '@/lib';
import type { NotebookPage } from '@/types';

import { LinkPreviewCard } from './LinkPreviewCard';

const LINK =
  'text-primary underline underline-offset-2 hover:decoration-2 focus-visible:outline-ring outline-offset-2 focus-visible:outline-2';
const CHIP =
  'bg-secondary text-secondary-foreground hover:bg-accent rounded-sm px-1 focus-visible:outline-ring outline-offset-1 focus-visible:outline-2';

/** One page's text with its web links, links to other pages, and the pages that link back. */
export function PageTranscript({
  page,
  index,
  backlinks,
  onGoTo,
}: {
  page: NotebookPage;
  index: NotebookIndex;
  backlinks: readonly Backlink[];
  onGoTo: (pageId: number) => void;
}) {
  const segments = pageSegments(page, index);
  const firstUrl = segments.find((segment) => segment.kind === 'url');
  return (
    <section
      aria-labelledby={`transcript-${page.id}`}
      className="flex flex-col gap-3"
    >
      <h2
        id={`transcript-${page.id}`}
        className="flex items-baseline gap-2 text-sm font-semibold"
      >
        Page {pageNumberOf(page)}
        {page.pageDate && (
          <span className="text-muted-foreground text-xs font-normal">
            {page.pageDate}
          </span>
        )}
      </h2>
      {segments.length > 0 ? (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {segments.map((segment, i) => {
            switch (segment.kind) {
              case 'text':
                return <Fragment key={i}>{segment.text}</Fragment>;
              case 'url':
                return (
                  <a
                    key={i}
                    href={segment.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={LINK}
                  >
                    {segment.text}
                  </a>
                );
              default:
                return (
                  <button
                    key={i}
                    type="button"
                    className={CHIP}
                    onClick={() => onGoTo(segment.pageId)}
                  >
                    {segment.text}
                  </button>
                );
            }
          })}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">Not transcribed yet.</p>
      )}
      {firstUrl?.kind === 'url' && <LinkPreviewCard href={firstUrl.href} />}
      {backlinks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-muted-foreground text-xs font-medium">
            Linked from
          </h3>
          <ul className="flex flex-col gap-1">
            {backlinks.map((link) => (
              <li key={link.pageId}>
                <button
                  type="button"
                  onClick={() => onGoTo(link.pageId)}
                  className="hover:bg-muted focus-visible:outline-ring flex w-full items-baseline gap-2 rounded-md border px-2 py-1.5 text-left text-sm outline-offset-2 focus-visible:outline-2"
                >
                  <span className="min-w-0 flex-1 truncate">{link.title}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    p. {link.number}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
