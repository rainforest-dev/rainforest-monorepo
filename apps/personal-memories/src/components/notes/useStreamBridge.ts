import { useEffect, useRef, useState } from 'react';

import type { ResolvedAnnotation } from '../../lib/notes/attach.ts';
import type { Annotation } from '../../lib/notes/types.ts';
import type { Draft } from './useNoteDraft.ts';

type Anchor = Omit<Annotation, 'body'>;

type Options = {
  date: string;
  draft: Draft;
  readOnly: boolean;
  edit: (next: (d: Draft) => Draft) => void;
  load: (date: string) => Promise<void>;
  onAnnotate: () => void;
};

export function useStreamBridge({
  date,
  draft,
  readOnly,
  edit,
  load,
  onAnnotate,
}: Options) {
  const [reattach, setReattach] = useState<number>();
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const focusNext = useRef<number>(undefined);

  const setAnnotation = (i: number, patch: Partial<ResolvedAnnotation>) =>
    edit((d) => ({
      ...d,
      annotations: d.annotations.map((a, j) =>
        j === i ? { ...a, ...patch } : a,
      ),
    }));

  useEffect(() => {
    const onDay = (e: Event) => {
      const next = (e as CustomEvent<{ date: string }>).detail.date;
      if (next !== date) void load(next);
    };
    const onAnnotateEvent = (e: Event) => {
      if (readOnly) return;
      const detail = (e as CustomEvent<Anchor>).detail;
      onAnnotate();
      if (reattach !== undefined) {
        setAnnotation(reattach, { ...detail, status: 'exact' });
        setReattach(undefined);
        return;
      }
      const existing = draft.annotations.findIndex(
        (a) => a.eventId === detail.eventId,
      );
      if (existing !== -1) {
        refs.current[existing]?.focus();
        return;
      }
      focusNext.current = draft.annotations.length;
      edit((d) => ({
        ...d,
        annotations: [
          ...d.annotations,
          { ...detail, body: '', status: 'exact' },
        ],
      }));
    };
    document.addEventListener('memories:day', onDay);
    document.addEventListener('memories:annotate', onAnnotateEvent);
    return () => {
      document.removeEventListener('memories:day', onDay);
      document.removeEventListener('memories:annotate', onAnnotateEvent);
    };
  });

  useEffect(() => setReattach(undefined), [date]);

  useEffect(() => {
    document
      .querySelectorAll('[data-annotated]')
      .forEach((el) => el.removeAttribute('data-annotated'));
    for (const a of draft.annotations) {
      if (a.status === 'unattached' || !a.eventId) continue;
      document
        .getElementById(`ev-${a.eventId}`)
        ?.setAttribute('data-annotated', '');
    }
    if (focusNext.current !== undefined) {
      refs.current[focusNext.current]?.focus();
      focusNext.current = undefined;
    }
  }, [draft.annotations]);

  return { reattach, setReattach, setAnnotation, refs };
}
