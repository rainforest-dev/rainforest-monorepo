import { Button, ButtonGroup, Spinner } from '@rainforest-dev/rainforest-react';
import { XIcon } from 'lucide-react';

import { READ_ONLY_NOTE, type Source } from '@/lib';
import {
  applicableNames,
  notApplicableNote,
  SOURCE_ACTION_LABEL,
  type SourceAction,
} from '@/lib/desk';

import type { SourceActionsState } from './useSourceActions';
import type { SourceSelection } from './useSourceSelection';

const ACTIONS: readonly SourceAction[] = ['activate', 'retire'];

export interface BulkToolbarProps {
  sources: readonly Source[];
  pageNames: readonly string[];
  selection: SourceSelection;
  actions: SourceActionsState;
}

export function BulkToolbar({
  sources,
  pageNames,
  selection,
  actions,
}: BulkToolbarProps) {
  const { selected } = selection;
  const allOnPage = pageNames.every((name) => selected.has(name));

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="flex min-h-8 flex-1 flex-wrap items-center gap-2"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Clear selection"
        onClick={selection.clear}
      >
        <XIcon aria-hidden="true" />
      </Button>
      <span aria-live="polite" className="text-sm font-medium tabular-nums">
        {selected.size} selected
      </span>
      {!allOnPage && (
        <Button
          variant="link"
          size="xs"
          onClick={() => selection.addMany(pageNames)}
        >
          Select all {pageNames.length} on this page
        </Button>
      )}
      <div className="flex items-center gap-2 sm:ml-auto">
        <ButtonGroup aria-label="Apply to selected">
          {ACTIONS.map((action) => {
            const names = applicableNames(sources, selected, action);
            const running = actions.isRunning('bulk', action);
            const blocked = names.some((name) => actions.pending.has(name));
            const title = !actions.writable
              ? READ_ONLY_NOTE
              : names.length === 0
                ? notApplicableNote(action)
                : undefined;
            return (
              <Button
                key={action}
                variant="outline"
                size="sm"
                title={title}
                disabled={
                  !actions.writable || names.length === 0 || running || blocked
                }
                onClick={() =>
                  void actions.run(names, action, 'bulk', selection.clear)
                }
              >
                {running && <Spinner data-icon="inline-start" />}
                {SOURCE_ACTION_LABEL[action]}{' '}
                <span className="tabular-nums">{names.length}</span>
              </Button>
            );
          })}
        </ButtonGroup>
        <Button variant="outline" size="sm" onClick={selection.done}>
          Done
        </Button>
      </div>
    </div>
  );
}
