import { useEffect, useRef } from 'react';

import { lineDiff } from '../../lib/diff.ts';
import type { NotePayload } from '../../lib/notes/payload.ts';
import type { Draft } from './useNoteDraft.ts';

type Props = {
  theirs: NotePayload;
  mine: Draft;
  onResolve: (keep: 'theirs' | 'mine') => void;
};

const BUTTON =
  'rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

function Card({
  title,
  lines,
  annotationCount,
  annotationCountChanged,
  onKeep,
}: {
  title: string;
  lines: { text: string; changed: boolean }[];
  annotationCount: number;
  annotationCountChanged: boolean;
  onKeep: () => void;
}) {
  return (
    <div className="bg-background min-w-0 space-y-2 rounded-md p-2">
      <h3 className="text-heading font-medium">{title}</h3>
      <div className="max-h-40 overflow-y-auto whitespace-pre-wrap">
        {lines.length === 0 ? (
          <p className="text-body text-muted-foreground">（空白）</p>
        ) : (
          lines.map((line, i) => (
            <p
              key={i}
              className={`text-body ${line.changed ? 'bg-info/15' : ''}`}
            >
              {line.text || ' '}
            </p>
          ))
        )}
      </div>
      <p
        className={`text-meta ${annotationCountChanged ? 'bg-info/15 text-foreground' : 'text-muted-foreground'}`}
      >
        {annotationCount} 則眉批
      </p>
      <button type="button" className={BUTTON} onClick={onKeep}>
        保留這個版本
      </button>
    </div>
  );
}

export function ConflictView({ theirs, mine, onResolve }: Props) {
  const diff = lineDiff(theirs.body, mine.body);
  const annotationCountChanged =
    theirs.annotations.length !== mine.annotations.length;
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    sectionRef.current?.focus();
  }, []);

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      role="alert"
      className="bg-info/10 space-y-3 rounded-lg p-3"
    >
      <div>
        <h2 className="text-heading font-medium">
          這一天在 Obsidian 裡也改過了
        </h2>
        <p className="text-meta text-muted-foreground">
          兩個版本都在下面，不同的地方已標出。選一個保留。
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card
          title="Obsidian 的版本"
          lines={diff.a}
          annotationCount={theirs.annotations.length}
          annotationCountChanged={annotationCountChanged}
          onKeep={() => onResolve('theirs')}
        />
        <Card
          title="這個畫面的版本"
          lines={diff.b}
          annotationCount={mine.annotations.length}
          annotationCountChanged={annotationCountChanged}
          onKeep={() => onResolve('mine')}
        />
      </div>
    </section>
  );
}
