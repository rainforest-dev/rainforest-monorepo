import type { NotePayload } from '../../lib/notes/payload.ts';
import type { Draft } from './useNoteDraft.ts';

type Props = {
  theirs: NotePayload;
  mine: Draft;
  onResolve: (keep: 'theirs' | 'mine') => void;
};

const BUTTON =
  'rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

function Column({ title, note }: { title: string; note: Draft }) {
  return (
    <div className="min-w-0 space-y-1">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="bg-background max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md p-2 text-sm">
        {note.body || '（空白）'}
      </p>
      <p className="text-muted-foreground text-xs">
        {note.annotations.length} 則眉批
      </p>
    </div>
  );
}

export function ConflictView({ theirs, mine, onResolve }: Props) {
  return (
    <section
      role="alert"
      className="border-warning bg-warning/15 space-y-3 rounded-lg border p-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <Column title="Obsidian 的版本" note={theirs} />
        <Column title="目前的版本" note={mine} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={BUTTON}
          onClick={() => onResolve('theirs')}
        >
          用 Obsidian 的版本
        </button>
        <button
          type="button"
          className={BUTTON}
          onClick={() => onResolve('mine')}
        >
          保留目前的版本
        </button>
      </div>
    </section>
  );
}
