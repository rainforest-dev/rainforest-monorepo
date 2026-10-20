import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Button,
  ButtonGroup,
  cn,
  Kbd,
  Spinner,
} from '@rainforest-dev/rainforest-react';
import { XIcon } from 'lucide-react';

import { actionLabel, type RegistryAction } from '@/lib/desk';
import { ROOM_NAMESPACE } from '@/locales';

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
  /** What `shownNames` are, for the select-all link. */
  shownScope: 'shown' | 'page';
  selection: RowSelection;
  actions: RegistryActionsState<A>;
  floating?: boolean;
}

export function BulkToolbar<A extends RegistryAction>({
  options,
  shownNames,
  shownScope,
  selection,
  actions,
  floating = false,
}: BulkToolbarProps<A>) {
  const { selected } = selection;
  const t = useLibraryT(ROOM_NAMESPACE);
  const allShown = shownNames.every((name) => selected.has(name));

  return (
    <div
      role="toolbar"
      aria-label={t('desk.bulk.label')}
      className={cn(
        'flex min-h-8 flex-1 flex-wrap items-center gap-2',
        floating &&
          // Above the library's phone tab bar when the layout sets --library-tab-bar.
          'bg-card text-card-foreground fixed inset-x-2 bottom-[calc(var(--library-tab-bar,0px)+0.5rem)] z-40 rounded-xl border p-2 shadow-lg',
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('desk.bulk.clear')}
        onClick={selection.clear}
      >
        <XIcon aria-hidden="true" />
      </Button>
      <span aria-live="polite" className="text-sm font-medium tabular-nums">
        {t('desk.bulk.selected', { count: selected.size })}
      </span>
      {!allShown && (
        <Button
          variant="link"
          size="xs"
          onClick={() => selection.addMany(shownNames)}
        >
          {t(
            shownScope === 'page'
              ? 'desk.bulk.selectAllPage'
              : 'desk.bulk.selectAllShown',
            { count: shownNames.length },
          )}
        </Button>
      )}
      <div className="flex items-center gap-2 sm:ml-auto">
        <ButtonGroup aria-label={t('desk.bulk.apply')}>
          {options.map(({ action, names, emptyNote }) => {
            const running = actions.isRunning('bulk', action);
            const blocked = names.some((name) => actions.pending.has(name));
            const title = !actions.writable
              ? t('desk.readOnly.note')
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
                {actionLabel(action, t)}{' '}
                <span className="tabular-nums">{names.length}</span>
              </Button>
            );
          })}
        </ButtonGroup>
        <Button variant="outline" size="sm" onClick={selection.done}>
          {t('desk.bulk.done')}
        </Button>
        <span className="text-muted-foreground hidden items-center gap-1 text-xs lg:inline-flex">
          <Kbd>Esc</Kbd> {t('desk.bulk.escClear')}
        </span>
      </div>
    </div>
  );
}
