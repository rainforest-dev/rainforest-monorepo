import { actions } from 'astro:actions';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ResolvedAnnotation } from '../../lib/notes/attach.ts';
import type { NotePayload } from '../../lib/notes/payload.ts';
import type { Annotation } from '../../lib/notes/types.ts';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';
export type Draft = { body: string; annotations: ResolvedAnnotation[] };

const SAVE_DELAY_MS = 1000;
const UNSAFE: readonly SaveStatus[] = ['dirty', 'saving', 'error', 'conflict'];

const toDraft = (p: NotePayload): Draft => ({
  body: p.body,
  annotations: p.annotations,
});

const toAnnotation = (a: ResolvedAnnotation): Annotation => ({
  eventId: a.eventId,
  at: a.at,
  source: a.source,
  author: a.author,
  excerpt: a.excerpt,
  body: a.body,
});

export function useNoteDraft(initial: NotePayload) {
  const [payload, setPayloadState] = useState(initial);
  const [draft, setDraftState] = useState(() => toDraft(initial));
  const [status, setStatusState] = useState<SaveStatus>('saved');
  const [conflict, setConflict] = useState<NotePayload>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);
  const current = useRef({ payload, draft, status });

  const setPayload = useCallback((p: NotePayload) => {
    current.current.payload = p;
    setPayloadState(p);
  }, []);
  const setDraft = useCallback((d: Draft) => {
    current.current.draft = d;
    setDraftState(d);
  }, []);
  const setStatus = useCallback((s: SaveStatus) => {
    current.current.status = s;
    setStatusState(s);
  }, []);

  const save = useCallback(() => {
    const run = async () => {
      const { payload: p, draft: d } = current.current;
      const rev = revision.current;
      setStatus('saving');
      try {
        const result = await actions.saveNote.orThrow({
          date: p.date,
          body: d.body,
          annotations: d.annotations.map(toAnnotation),
          cover: p.cover,
          version: p.version,
        });
        if (result.ok) {
          setPayload({ ...current.current.payload, version: result.version });
          if (revision.current === rev) setStatus('saved');
        } else {
          clearTimeout(timer.current);
          setConflict(result.current);
          setStatus('conflict');
        }
      } catch {
        setStatus('error');
      }
    };
    pending.current = pending.current.then(run);
    return pending.current;
  }, [setPayload, setStatus]);

  const edit = useCallback(
    (next: (d: Draft) => Draft) => {
      setDraft(next(current.current.draft));
      revision.current += 1;
      if (current.current.status === 'conflict') return;
      setStatus('dirty');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
    },
    [save, setDraft, setStatus],
  );

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const s = current.current.status;
    if (s === 'dirty' || s === 'error') await save();
    else await pending.current;
  }, [save]);

  const replace = useCallback(
    (next: NotePayload) => {
      setPayload(next);
      setDraft(toDraft(next));
      setConflict(undefined);
    },
    [setDraft, setPayload],
  );

  const resolveConflict = useCallback(
    (keep: 'theirs' | 'mine') => {
      if (!conflict) return;
      setConflict(undefined);
      if (keep === 'theirs') {
        replace(conflict);
        setStatus('saved');
      } else {
        setPayload({ ...current.current.payload, version: conflict.version });
        void save();
      }
    },
    [conflict, replace, save, setPayload, setStatus],
  );

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!UNSAFE.includes(current.current.status)) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  return {
    payload,
    draft,
    status,
    conflict,
    current,
    edit,
    flush,
    replace,
    resolveConflict,
  };
}
