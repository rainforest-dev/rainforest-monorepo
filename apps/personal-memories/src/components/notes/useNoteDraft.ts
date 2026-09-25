import { actions } from 'astro:actions';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  applyStamps,
  type Draft,
  saveInput,
  toDraft,
} from '../../lib/notes/draft.ts';
import type { NotePayload } from '../../lib/notes/payload.ts';

export type { Draft } from '../../lib/notes/draft.ts';
export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

const SAVE_DELAY_MS = 1000;
const UNSAFE: readonly SaveStatus[] = ['dirty', 'saving', 'error', 'conflict'];

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
        const result = await actions.saveNote.orThrow(saveInput(p, d));
        if (result.ok) {
          setPayload({ ...current.current.payload, version: result.version });
          setDraft({
            ...current.current.draft,
            annotations: applyStamps(
              d.annotations,
              current.current.draft.annotations,
              result.annotations,
            ),
          });
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
  }, [setDraft, setPayload, setStatus]);

  const edit = useCallback(
    (date: string, next: (d: Draft) => Draft) => {
      if (date !== current.current.payload.date) return;
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
    // iOS Safari never fires beforeunload, so save when the page is hidden.
    const hide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [flush]);

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
