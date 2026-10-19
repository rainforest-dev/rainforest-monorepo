'use client';

import { type Bookcase, cn, itemsLabel, spineColor } from '@/lib';
import { useHall } from '@/providers';

const PREVIEW_SPINES = 14;

interface Props {
  cases: readonly Bookcase[];
  onEnter: (bookcase: Bookcase) => void;
  /** Visually hidden: the 3D hall's keyboard and screen-reader route to the same bookcases. */
  hidden?: boolean;
}

/** The hall without 3D: one button per bookcase, opening it in the Study. */
export function CssHall({ cases, onEnter, hidden = false }: Props) {
  const { bookById } = useHall();
  return (
    <ul
      aria-label="書櫃"
      data-hall-list
      className={cn(
        hidden
          ? 'sr-only'
          : 'grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3',
      )}
    >
      {cases.map((bookcase) => (
        <li key={bookcase.key}>
          <button
            type="button"
            data-hall-case={bookcase.key}
            onClick={() => onEnter(bookcase)}
            className="bg-card hover:bg-muted focus-visible:ring-ring flex w-full flex-col gap-2 rounded-lg border p-3 text-left outline-none focus-visible:ring-2"
          >
            <span aria-hidden className="flex h-12 items-end gap-0.5">
              {bookcase.bookIds.slice(0, PREVIEW_SPINES).map((id) => (
                <span
                  key={id}
                  className="w-2 rounded-[2px]"
                  style={{
                    height: `${60 + ((id * 13) % 38)}%`,
                    background: spineColor(bookById.get(id)?.color ?? '#888'),
                  }}
                />
              ))}
            </span>
            <span className="truncate text-sm font-medium">
              {bookcase.label}
            </span>
            <span className="text-muted-foreground text-xs">
              {itemsLabel(bookcase.bookIds.length)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
