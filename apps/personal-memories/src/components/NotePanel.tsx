import { useEffect, useRef, useState } from 'react';

import { dayInUrl } from '../lib/client/day-url.ts';
import { toggleCover } from '../lib/cover.ts';
import { coverControl } from '../lib/lightbox.ts';
import { withCover } from '../lib/notes/draft.ts';
import type { NotePayload } from '../lib/notes/payload.ts';
import { dayHeading } from '../lib/weeks.ts';
import { Lightbox } from './lightbox/Lightbox.tsx';
import { useLightbox } from './lightbox/useLightbox.ts';
import { AnnotationList } from './notes/AnnotationItem.tsx';
import {
  BottomSheet,
  CHIPS,
  LOAD_FAILED,
  Notice,
  StatusChip,
} from './notes/BottomSheet.tsx';
import { ConflictView } from './notes/ConflictView.tsx';
import { useAuthorName } from './notes/useAuthorName.ts';
import { useDaySync } from './notes/useDaySync.ts';
import { useNoteDraft } from './notes/useNoteDraft.ts';
import { useStreamBridge } from './notes/useStreamBridge.ts';

const PLACEHOLDER = '這一天想起了什麼？';
const TITLE = 'text-meta font-semibold';

export function NotePanel({ initial }: { initial: NotePayload }) {
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
      <span className="flex items-center justify-between gap-3">
        <span className={TITLE}>這一天的回憶</span>
        {chip && <StatusChip chip={chip} />}
      </span>
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
      <BottomSheet open={open} onOpenChange={setOpen} peek={peek}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className={TITLE}>這一天的回憶</h2>
            <span className="text-muted-foreground truncate text-xs tabular-nums">
              {dayHeading(date)}
            </span>
          </div>
          {chip && <StatusChip chip={chip} />}
        </div>
        {(payload.parseError || readOnly) && (
          <div className="mb-3">
            <Notice>
              {payload.parseError
                ? '這一天的筆記檔格式有誤，請在 Obsidian 修正後重新整理。'
                : '唯讀。尚未設定儲存位置，回憶和眉批暫時無法寫入。'}
            </Notice>
          </div>
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
            <div className="bg-muted/55 text-body whitespace-pre-wrap rounded-lg px-4 py-3.5">
              {draft.body}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-2" hidden={!!conflict}>
            <textarea
              ref={memoryRef}
              aria-label="當天的回憶"
              placeholder={PLACEHOLDER}
              value={draft.body}
              disabled={locked}
              onChange={(e) =>
                edit(date, (d) => ({ ...d, body: e.target.value }))
              }
              className="border-input bg-background text-body focus-visible:border-ring focus-visible:ring-ring/35 focus-visible:ring-3 placeholder:text-muted-foreground min-h-[180px] w-full resize-none rounded-lg border px-4 py-3.5 outline-none disabled:opacity-60 lg:min-h-[232px]"
            />
            <p className="text-muted-foreground text-xs">Markdown · 自動儲存</p>
          </div>
        )}
        <AnnotationList
          annotations={draft.annotations}
          disabled={locked}
          readOnly={readOnly}
          reattach={reattach}
          refs={refs}
          needsName={author.needsName}
          onName={author.save}
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
      </BottomSheet>
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
