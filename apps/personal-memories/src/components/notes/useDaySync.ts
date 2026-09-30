import { actions } from 'astro:actions';
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';

import type { NotePayload } from '../../lib/notes/payload.ts';
import type { SaveStatus } from './useNoteDraft.ts';

type Options = {
  current: RefObject<{ payload: NotePayload; status: SaveStatus }>;
  status: SaveStatus;
  flush: () => Promise<void>;
  replace: (next: NotePayload) => void;
};

export function useDaySync({ current, status, flush, replace }: Options) {
  const [loadFailed, setLoadFailed] = useState(false);
  const wanted = useRef(current.current.payload.date);
  const running = useRef(false);

  const sync = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (wanted.current !== current.current.payload.date) {
        await flush();
        if (current.current.status !== 'saved') return;
        const date = wanted.current;
        let next: NotePayload;
        try {
          next = await actions.getNote.orThrow({ date });
        } catch {
          setLoadFailed(true);
          return;
        }
        setLoadFailed(false);
        if (current.current.status !== 'saved') return;
        if (wanted.current === date) flushSync(() => replace(next));
      }
    } finally {
      running.current = false;
    }
  }, [current, flush, replace]);

  const request = useCallback(
    (date: string) => {
      wanted.current = date;
      void sync();
    },
    [sync],
  );

  useEffect(() => {
    if (status === 'saved') void sync();
  }, [status, sync]);

  return { request, loadFailed };
}
