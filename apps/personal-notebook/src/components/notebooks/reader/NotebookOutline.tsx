'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';

import { cn, type OutlineSection } from '@/lib';
import { NOTEBOOK_NAMESPACE } from '@/locales';

/** The notebook's table of contents, from the first line of each transcribed page. */
export function NotebookOutline({
  sections,
  currentIds,
  onGoTo,
}: {
  sections: readonly OutlineSection[];
  currentIds: ReadonlySet<number>;
  onGoTo: (pageId: number) => void;
}) {
  const t = useLibraryT(NOTEBOOK_NAMESPACE);
  if (sections.length === 0)
    return (
      <p className="text-muted-foreground px-2 text-sm">{t('outline.empty')}</p>
    );
  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <section key={section.group} className="flex flex-col gap-0.5">
          <h3 className="text-muted-foreground px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide">
            {t(`outline.group.${section.group}`)}
          </h3>
          <ul className="flex flex-col gap-0.5">
            {section.entries.map((entry) => {
              const current = currentIds.has(entry.pageId);
              return (
                <li key={entry.pageId}>
                  <button
                    type="button"
                    aria-current={current ? 'page' : undefined}
                    onClick={() => onGoTo(entry.pageId)}
                    className={cn(
                      'hover:bg-sidebar-accent focus-visible:outline-ring flex w-full items-baseline gap-2 rounded-md px-2 py-2.5 text-left text-sm outline-offset-1 focus-visible:outline-2 lg:py-1.5',
                      current && 'bg-sidebar-accent font-semibold',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {entry.title}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {entry.number}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
