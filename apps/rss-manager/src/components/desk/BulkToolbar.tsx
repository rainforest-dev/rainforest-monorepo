import {
  Button,
  ButtonGroup,
  Kbd,
  Spinner,
} from '@rainforest-dev/rainforest-react';
import { XIcon } from 'lucide-react';

import { READ_ONLY_NOTE } from '@/lib';
import { ACTION_LABEL, type RegistryAction } from '@/lib/desk';

import type { RegistryActionsState } from './useRegistryActions';
import type { RowSelection } from './useRowSelection';

export interface BulkOption<A extends RegistryAction> {
  action: A;
  names: readonly string[];
  emptyNote: string;
}

export interface BulkToolbarProps<A extends RegistryAction> {
  options: readonly BulkOption<A>[];
  shownNames: readonly string[];
  shownLabel: string;
  selection: RowSelection;
  actions: RegistryActionsState<A>;
}

export function BulkToolbar<A extends RegistryAction>({
  options,
  shownNames,
  shownLabel,
  selection,
  actions,
}: BulkToolbarProps<A>) {
  const { selected } = selection;
  const allShown = shownNames.every((name) => selected.has(name));

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
      {!allShown && (
        <Button
          variant="link"
          size="xs"
          onClick={() => selection.addMany(shownNames)}
        >
          Select all {shownNames.length} {shownLabel}
        </Button>
      )}
      <div className="flex items-center gap-2 sm:ml-auto">
        <ButtonGroup aria-label="Apply to selected">
          {options.map(({ action, names, emptyNote }) => {
            const running = actions.isRunning('bulk', action);
            const blocked = names.some((name) => actions.pending.has(name));
            const title = !actions.writable
              ? READ_ONLY_NOTE
              : names.length === 0
                ? emptyNote
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
                {ACTION_LABEL[action]}{' '}
                <span className="tabular-nums">{names.length}</span>
              </Button>
            );
          })}
        </ButtonGroup>
        <Button variant="outline" size="sm" onClick={selection.done}>
          Done
        </Button>
        <span className="text-muted-foreground hidden items-center gap-1 text-xs lg:inline-flex">
          <Kbd>Esc</Kbd> clear
        </span>
      </div>
    </div>
  );
}
