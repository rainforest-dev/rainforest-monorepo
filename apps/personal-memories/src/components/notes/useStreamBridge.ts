import { type RefObject, useEffect, useRef, useState } from 'react';

import type { ResolvedAnnotation } from '../../lib/notes/attach.ts';
import type { Annotation } from '../../lib/notes/types.ts';
import { taipeiDate } from '../../lib/weeks.ts';
import type { Draft } from './useNoteDraft.ts';

type Anchor = Omit<Annotation, 'body'>;

const DAY_PATH = /^\/day\/(\d{4}-\d{2}-\d{2})$/;

type Options = {
  date: string;
  draft: Draft;
  current: RefObject<{ draft: Draft; payload: { date: string } }>;
  readOnly: boolean;
  edit: (date: string, next: (d: Draft) => Draft) => void;
  request: (date: string) => void;
  onAnnotate: () => void;
};

function markAnnotated(annotations: readonly ResolvedAnnotation[]) {
  document
    .querySelectorAll('[data-annotated]')
    .forEach((el) => el.removeAttribute('data-annotated'));
  for (const a of annotations) {
    if (a.status === 'unattached' || !a.eventId) continue;
    document
      .getElementById(`ev-${a.eventId}`)
      ?.setAttribute('data-annotated', '');
  }
}

export function useStreamBridge(o: Options) {
  const [reattach, setReattach] = useState<number>();
  const [focusTick, setFocusTick] = useState(0);
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const focusNext = useRef<number>(undefined);
  const queued = useRef<Anchor>(undefined);
  const latest = useRef(o);
  latest.current = o;
  const reattachRef = useRef(reattach);
  reattachRef.current = reattach;

  const focus = (i: number) => {
    focusNext.current = i;
    setFocusTick((t) => t + 1);
  };

  const setAnnotation = (
    date: string,
    i: number,
    patch: Partial<ResolvedAnnotation>,
  ) =>
    latest.current.edit(date, (d) => ({
      ...d,
      annotations: d.annotations.map((a, j) =>
        j === i ? { ...a, ...patch } : a,
      ),
    }));

  const annotate = (anchor: Anchor, target?: number) => {
    const { current, edit } = latest.current;
    const { date } = current.current.payload;
    const annotations = current.current.draft.annotations;
    const existing = annotations.findIndex((a) => a.eventId === anchor.eventId);
    if (existing !== -1 && existing !== target) return focus(existing);
    if (target !== undefined) {
      setAnnotation(date, target, { ...anchor, status: 'exact' });
      return focus(target);
    }
    edit(date, (d) => ({
      ...d,
      annotations: [...d.annotations, { ...anchor, body: '', status: 'exact' }],
    }));
    focus(annotations.length);
  };

  useEffect(() => {
    const onDay = (e: Event) => {
      const next = (e as CustomEvent<{ date: string }>).detail.date;
      if (queued.current && taipeiDate(queued.current.at) !== next) {
        queued.current = undefined;
      }
      latest.current.request(next);
    };
    const onAnnotate = (e: Event) => {
      const { readOnly, current, onAnnotate: open, request } = latest.current;
      if (readOnly) return;
      const anchor = (e as CustomEvent<Anchor>).detail;
      const target = reattachRef.current;
      open();
      setReattach(undefined);
      const day = taipeiDate(anchor.at);
      if (day !== current.current.payload.date) {
        queued.current = anchor;
        request(day);
        return;
      }
      annotate(anchor, target);
    };
    document.addEventListener('memories:day', onDay);
    document.addEventListener('memories:annotate', onAnnotate);
    const shown = DAY_PATH.exec(location.pathname)?.[1];
    if (shown && shown !== latest.current.current.current.payload.date) {
      latest.current.request(shown);
    }
    return () => {
      document.removeEventListener('memories:day', onDay);
      document.removeEventListener('memories:annotate', onAnnotate);
    };
  }, []);

  useEffect(() => {
    setReattach(undefined);
    if (queued.current && taipeiDate(queued.current.at) === o.date) {
      if (!o.readOnly) annotate(queued.current);
      queued.current = undefined;
    }
  }, [o.date, o.readOnly]);

  useEffect(() => markAnnotated(o.draft.annotations), [o.draft.annotations]);

  useEffect(() => {
    const onRestored = (e: Event) => {
      const { draft, payload } = latest.current.current.current;
      const date = (e as CustomEvent<{ date?: string } | null>).detail?.date;
      if (date === payload.date) markAnnotated(draft.annotations);
    };
    document.addEventListener('memories:day-restored', onRestored);
    return () =>
      document.removeEventListener('memories:day-restored', onRestored);
  }, []);

  useEffect(() => {
    if (focusNext.current === undefined) return;
    refs.current[focusNext.current]?.focus();
    focusNext.current = undefined;
  }, [focusTick, o.draft.annotations]);

  return { reattach, setReattach, setAnnotation, refs };
}
