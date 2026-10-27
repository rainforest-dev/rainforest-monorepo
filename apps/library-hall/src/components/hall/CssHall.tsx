'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';

import { type Bookcase, cn, type HallRack, spineColor, type Wing } from '@/lib';
import { HALL_NAMESPACE } from '@/locales';
import { useHall } from '@/providers';

import { RackCard } from './RackCard';
import { useUnsortedNote } from './useUnsortedNote';

const PREVIEW_SPINES = 14;

interface Props {
  wings: readonly Wing[];
  onEnter: (bookcase: Bookcase) => void;
  /** The magazine rack by the door; `null` while it loads. */
  rack: HallRack | null;
  /** Visually hidden: the 3D hall's keyboard and screen-reader route to the same bookcases. */
  hidden?: boolean;
}

/** The hall without 3D: each wing's bookcases under its name, each opening in the Study. */
export function CssHall({ wings, onEnter, rack, hidden = false }: Props) {
  const { bookById } = useHall();
  const unsortedNote = useUnsortedNote();
  const t = useLibraryT(HALL_NAMESPACE);
  return (
    <div
      aria-label={t('hall.list')}
      role="group"
      data-hall-list
      className={cn(hidden ? 'sr-only' : 'flex flex-col gap-5')}
    >
      <RackCard rack={rack} />
      {wings.map((wing) => {
        const note = unsortedNote(wing);
        return (
          <section
            key={wing.id}
            data-hall-wing={wing.id}
            aria-label={wing.label}
          >
            <h2 className="text-muted-foreground mb-2 text-sm font-semibold">
              {wing.label}
              {note ? (
                <span data-hall-unsorted className="ms-2 font-normal">
                  {note}
                </span>
              ) : null}
            </h2>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
              {wing.cases.map((bookcase) => (
                <CaseButton
                  key={bookcase.key}
                  bookcase={bookcase}
                  onEnter={onEnter}
                  colorOf={(id) => bookById.get(id)?.color ?? '#888'}
                  count={t('items', { count: bookcase.bookIds.length })}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function CaseButton({
  bookcase,
  onEnter,
  colorOf,
  count,
}: {
  bookcase: Bookcase;
  onEnter: (bookcase: Bookcase) => void;
  colorOf: (id: number) => string;
  count: string;
}) {
  return (
    <li>
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
                background: spineColor(colorOf(id)),
              }}
            />
          ))}
        </span>
        <span className="truncate text-sm font-medium">{bookcase.label}</span>
        <span className="text-muted-foreground text-xs">{count}</span>
      </button>
    </li>
  );
}
