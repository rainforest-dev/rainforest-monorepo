import { Separator, Textarea } from '@rainforest-dev/rainforest-react';
import { useEffect, useRef, useState } from 'react';

import { dayInUrl } from '../lib/client/day-url.ts';
import { toggleCover } from '../lib/cover.ts';
import { coverControl } from '../lib/lightbox.ts';
import { withCover } from '../lib/notes/draft.ts';
import type { NotePayload } from '../lib/notes/payload.ts';
import type { Accent } from '../lib/stream.ts';
import { Lightbox } from './lightbox/Lightbox.tsx';
import { useLightbox } from './lightbox/useLightbox.ts';
import { AnnotationList } from './notes/AnnotationItem.tsx';
import { ConflictView } from './notes/ConflictView.tsx';
import { DiaryDate } from './notes/DiaryDate.tsx';
import { NotesSurface } from './notes/NotesSurface.tsx';
import { ReadOnlyNotice } from './notes/ReadOnlyNotice.tsx';
import { CHIPS, LOAD_FAILED, StatusBadge } from './notes/StatusBadge.tsx';
import { useAuthorName } from './notes/useAuthorName.ts';
import { useDaySync } from './notes/useDaySync.ts';
import { useNoteDraft } from './notes/useNoteDraft.ts';
import { useStreamBridge } from './notes/useStreamBridge.ts';

const PLACEHOLDER = '這一天想起了什麼？';

export function NotePanel({
  initial,
  accents,
}: {
  initial: NotePayload;
  accents: Record<string, Accent>;
}) {
  const note = useNoteDraft(initial);
  const { payload, draft, status, conflict, current, edit } = note;
  const { request, loadFailed } = useDaySync({ ...note, current });
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const memoryRef = useRef<HTMLTextAreaElement>(null);
  const pendingFocus = useRef(false);
  const focusMemory = () => {
    const el = memoryRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  };
  useEffect(() => {
    const onFocus = () => {
      if (open) focusMemory();
      else {
        pendingFocus.current = true;
        setOpen(true);
      }
    };
    document.addEventListener('memories:focus-note', onFocus);
    return () => document.removeEventListener('memories:focus-note', onFocus);
  }, [open]);
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    focusMemory();
  }, [open]);
  const readOnly = !payload.writable;
  const { date } = payload;
  const locked = readOnly || !hydrated;
  const author = useAuthorName(payload.viewer);
  const { reattach, setReattach, setAnnotation, refs } = useStreamBridge({
    date,
    draft,
    current,
    readOnly,
    edit,
    request,
    onAnnotate: () => setOpen(true),
    author: author.name,
  });
  const lightbox = useLightbox();
  const shown = lightbox.request;
  useEffect(() => {
    if (shown && shown.date !== date) request(shown.date);
  }, [shown?.date, date, request]);
  const item = shown?.items[shown.index];
  const coverOnDay =
    !!shown &&
    !!draft.cover &&
    !!document.querySelector(
      `[data-day="${shown.date}"] [data-event-id="${CSS.escape(draft.cover)}"]`,
    );
  const cover = item
    ? coverControl({
        writable: !readOnly,
        loaded: hydrated && shown?.date === date && status !== 'conflict',
        item,
        cover: draft.cover,
        coverOnDay,
        autoCover: shown?.autoCover,
      })
    : 'hidden';
  const closeLightbox = () => {
    lightbox.close();
    const inView = dayInUrl();
    if (inView && inView !== date) request(inView);
  };
  const chip =
    loadFailed && status === 'saved'
      ? LOAD_FAILED
      : readOnly
        ? undefined
        : CHIPS[status];
  const count = draft.annotations.length;

  const peek = (
    <>
      <span className="text-muted-foreground text-xs tabular-nums">
        眉批 {count}
      </span>
      <span
        className={`text-meta line-clamp-2 whitespace-pre-line ${draft.body ? '' : 'text-muted-foreground'}`}
      >
        {draft.body || (readOnly ? '' : PLACEHOLDER)}
      </span>
    </>
  );

  return (
    <>
      <NotesSurface
        expanded={open}
        onExpandedChange={setOpen}
        title="這一天的回憶"
        date={<DiaryDate date={date} />}
        status={chip && <StatusBadge chip={chip} />}
        peek={peek}
      >
        {(payload.parseError || readOnly) && (
          <ReadOnlyNotice parseError={!!payload.parseError} />
        )}
        {conflict && (
          <ConflictView
            theirs={conflict}
            mine={draft}
            onResolve={note.resolveConflict}
          />
        )}
        {readOnly ? (
          draft.body && (
            <div className="bg-muted/50 text-body whitespace-pre-wrap rounded-lg px-4 py-3.5">
              {draft.body}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-2" hidden={!!conflict}>
            <Textarea
              ref={memoryRef}
              aria-label="當天的回憶"
              placeholder={PLACEHOLDER}
              value={draft.body}
              disabled={locked}
              onChange={(e) =>
                edit(date, (d) => ({ ...d, body: e.target.value }))
              }
              className="text-body md:text-body min-h-49 lg:min-h-63 resize-none px-1 py-0"
              data-ruled
            />
            <p className="text-muted-foreground text-xs">Markdown · 自動儲存</p>
          </div>
        )}
        <Separator className="my-6" />
        <AnnotationList
          annotations={draft.annotations}
          disabled={locked}
          readOnly={readOnly}
          reattach={reattach}
          refs={refs}
          needsName={author.needsName}
          onName={author.save}
          accentOf={(author) => accents[author]}
          onBody={(i, body) => setAnnotation(date, i, { body })}
          onReattach={setReattach}
          onDelete={(i) => {
            setReattach(undefined);
            edit(date, (d) => ({
              ...d,
              annotations: d.annotations.filter((_, j) => j !== i),
            }));
          }}
        />
      </NotesSurface>
      <Lightbox
        items={shown?.items}
        index={shown?.index ?? 0}
        cover={cover}
        finalFocus={lightbox.trigger}
        onStep={lightbox.step}
        onSelect={lightbox.select}
        onClose={closeLightbox}
        onToggleCover={() => {
          if (item)
            edit(date, (d) => withCover(d, toggleCover(d.cover, item.id)));
        }}
      />
    </>
  );
}
