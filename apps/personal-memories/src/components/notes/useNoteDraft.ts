import { actions } from 'astro:actions';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ResolvedAnnotation } from '../../lib/notes/attach.ts';
import type { NotePayload } from '../../lib/notes/payload.ts';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';
export type Draft = { body: string; annotations: ResolvedAnnotation[] };

const SAVE_DELAY_MS = 1000;

const toDraft = (p: NotePayload): Draft => ({
  body: p.body,
  annotations: p.annotations,
});

export function useNoteDraft(initial: NotePayload) {
  const [payload, setPayload] = useState(initial);
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [status, setStatusState] = useState<SaveStatus>('saved');
  const [conflict, setConflict] = useState<NotePayload>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const statusRef = useRef<SaveStatus>('saved');
  const versionRef = useRef(initial.version);
  const revision = useRef(0);
  const latest = useRef({ payload, draft });
  latest.current = { payload, draft };

  const setStatus = useCallback((s: SaveStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const save = useCallback(() => {
    const run = async () => {
      const { payload: p, draft: d } = latest.current;
      const rev = revision.current;
      setStatus('saving');
      try {
        const result = await actions.saveNote.orThrow({
          date: p.date,
          body: d.body,
          annotations: d.annotations.map(
            ({ eventId, at, source, author, excerpt, body }) => ({
              eventId,
              at,
              source,
              author,
              excerpt,
              body,
            }),
          ),
          cover: p.cover,
          version: versionRef.current,
        });
        if (result.ok) {
          versionRef.current = result.version;
          setPayload((prev) => ({ ...prev, version: result.version }));
          if (revision.current === rev) setStatus('saved');
        } else {
          setConflict(result.current);
          setStatus('conflict');
        }
      } catch {
        setStatus('error');
      }
    };
    pending.current = pending.current.then(run);
    return pending.current;
  }, [setStatus]);

  const edit = useCallback(
    (next: (d: Draft) => Draft) => {
      setDraft(next);
      revision.current += 1;
      if (statusRef.current === 'conflict') return;
      setStatus('dirty');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
    },
    [save, setStatus],
  );

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const s = statusRef.current;
    if (s === 'dirty' || s === 'error') await save();
    else await pending.current;
  }, [save]);

  const load = useCallback(
    async (date: string) => {
      await flush();
      if (statusRef.current !== 'saved') return;
      const next = await actions.getNote.orThrow({ date });
      if (statusRef.current !== 'saved') return;
      versionRef.current = next.version;
      setPayload(next);
      setDraft(toDraft(next));
      setConflict(undefined);
    },
    [flush],
  );

  const resolveConflict = useCallback(
    (keep: 'theirs' | 'mine') => {
      if (!conflict) return;
      versionRef.current = conflict.version;
      setConflict(undefined);
      if (keep === 'theirs') {
        setPayload(conflict);
        setDraft(toDraft(conflict));
        setStatus('saved');
      } else {
        setPayload((prev) => ({ ...prev, version: conflict.version }));
        void save();
      }
    },
    [conflict, save, setStatus],
  );

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      const s = statusRef.current;
      if (s === 'dirty' || s === 'saving' || s === 'error') e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  return { payload, draft, status, conflict, edit, load, resolveConflict };
}
