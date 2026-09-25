import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@rainforest-dev/rainforest-react';
import { useEffect, useRef } from 'react';

import { lineDiff } from '../../lib/diff.ts';
import type { NotePayload } from '../../lib/notes/payload.ts';
import type { Draft } from './useNoteDraft.ts';

type Props = {
  theirs: NotePayload;
  mine: Draft;
  onResolve: (keep: 'theirs' | 'mine') => void;
};

type Line = { text: string; changed: boolean };

function VersionCard({
  title,
  lines,
  annotations,
  countChanged,
  onKeep,
}: {
  title: string;
  lines: Line[];
  annotations: number;
  countChanged: boolean;
  onKeep: () => void;
}) {
  return (
    <Card size="sm" className="min-w-0">
      <CardHeader>
        <CardTitle role="heading" aria-level={3}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="max-h-40 overflow-y-auto whitespace-pre-wrap">
          {lines.length === 0 ? (
            <p className="text-body text-muted-foreground">（空白）</p>
          ) : (
            lines.map((line, i) => (
              <p
                key={i}
                className={`text-body rounded-sm ${line.changed ? 'bg-info/15' : ''}`}
              >
                {line.text || ' '}
              </p>
            ))
          )}
        </div>
        <p
          className={`text-meta ${countChanged ? 'bg-info/15 text-foreground' : 'text-muted-foreground'}`}
        >
          {annotations} 則眉批
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" onClick={onKeep}>
          保留這個版本
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ConflictView({ theirs, mine, onResolve }: Props) {
  const diff = lineDiff(theirs.body, mine.body);
  const countChanged = theirs.annotations.length !== mine.annotations.length;
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    sectionRef.current?.focus();
  }, []);

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      className="mb-4 flex flex-col gap-3 outline-none"
    >
      <Alert variant="info">
        <AlertTitle>這一天在 Obsidian 裡也改過了</AlertTitle>
        <AlertDescription>
          兩個版本都在下面，不同的地方已標出。選一個保留。
        </AlertDescription>
      </Alert>
      <div className="grid gap-3 lg:grid-cols-2">
        <VersionCard
          title="Obsidian 的版本"
          lines={diff.a}
          annotations={theirs.annotations.length}
          countChanged={countChanged}
          onKeep={() => onResolve('theirs')}
        />
        <VersionCard
          title="這個畫面的版本"
          lines={diff.b}
          annotations={mine.annotations.length}
          countChanged={countChanged}
          onKeep={() => onResolve('mine')}
        />
      </div>
    </section>
  );
}
