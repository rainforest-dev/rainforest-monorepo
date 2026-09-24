import type { Ref, RefObject } from 'react';

import type { ResolvedAnnotation } from '../../lib/notes/attach.ts';
import { SOURCE_LABELS } from '../../lib/notes/types.ts';
import { taipeiTime } from '../../lib/weeks.ts';

type Props = {
  annotation: ResolvedAnnotation;
  disabled: boolean;
  readOnly: boolean;
  reattaching: boolean;
  textareaRef: Ref<HTMLTextAreaElement>;
  onBody: (body: string) => void;
  onReattach: () => void;
  onDelete: () => void;
};

const FOCUS =
  'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2';
const EXCERPT =
  'text-muted-foreground border-border text-meta line-clamp-2 border-l-2 pl-2.5 leading-[1.6]';
const NOTE = 'text-sm leading-[1.65]';

function UnlinkIcon() {
  return (
    <svg
      aria-hidden
      className="size-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 17H7A5 5 0 0 1 7 7" />
      <path d="M15 7h2a5 5 0 0 1 4 8" />
      <path d="M8 12h4" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export function AnnotationItem({
  annotation: a,
  disabled,
  readOnly,
  reattaching,
  textareaRef,
  onBody,
  onReattach,
  onDelete,
}: Props) {
  const attached = a.status !== 'unattached';
  const meta = [taipeiTime(a.at), SOURCE_LABELS[a.source], a.author].join(
    ' · ',
  );
  return (
    <li
      className={`flex flex-col gap-2 rounded-lg px-4 py-3.5 ${attached ? 'bg-card ring-border focus-within:bg-primary/10 focus-within:ring-primary/40 ring-1' : 'border-border border border-dashed'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs tabular-nums">
          {!attached && <UnlinkIcon />}
          {attached ? meta : `找不到原本的訊息 · 原為 ${meta}`}
        </span>
        {!readOnly && (
          <button
            type="button"
            className={`text-muted-foreground hover:bg-muted -my-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs disabled:opacity-50 ${FOCUS}`}
            disabled={disabled}
            onClick={onDelete}
          >
            刪除
          </button>
        )}
      </div>
      {attached ? (
        <a
          href={`#ev-${a.eventId}`}
          className={`${EXCERPT} underline-offset-2 hover:underline ${FOCUS}`}
        >
          {a.excerpt}
        </a>
      ) : (
        <p className={EXCERPT}>{a.excerpt}</p>
      )}
      {readOnly ? (
        a.body && <p className={`${NOTE} whitespace-pre-wrap`}>{a.body}</p>
      ) : (
        <textarea
          ref={textareaRef}
          aria-label={`眉批：${a.excerpt}`}
          value={a.body}
          disabled={disabled}
          rows={2}
          onChange={(e) => onBody(e.target.value)}
          className={`${NOTE} border-input bg-background focus-visible:border-ring focus-visible:ring-ring/35 focus-visible:ring-3 w-full resize-y rounded-md border px-2.5 py-1.5 outline-none disabled:opacity-60`}
        />
      )}
      {!attached && !readOnly && (
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-pressed={reattaching}
            className={`bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-pressed:ring-ring text-meta h-8 shrink-0 rounded-md px-3 font-medium disabled:opacity-50 aria-pressed:ring-2 ${FOCUS}`}
            disabled={disabled}
            onClick={onReattach}
          >
            重新連結
          </button>
          <span
            className={`text-xs ${reattaching ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            再點選串流裡的一則訊息
          </span>
        </div>
      )}
    </li>
  );
}

type ListProps = {
  annotations: readonly ResolvedAnnotation[];
  disabled: boolean;
  readOnly: boolean;
  reattach: number | undefined;
  refs: RefObject<(HTMLTextAreaElement | null)[]>;
  onBody: (i: number, body: string) => void;
  onReattach: (i: number) => void;
  onDelete: (i: number) => void;
};

export function AnnotationList({
  annotations,
  reattach,
  refs,
  onBody,
  onReattach,
  onDelete,
  ...rest
}: ListProps) {
  if (rest.readOnly && annotations.length === 0) return null;
  const ordered = annotations
    .map((a, i) => ({ a, i }))
    .sort(
      (x, y) =>
        Number(y.a.status === 'unattached') -
        Number(x.a.status === 'unattached'),
    );
  return (
    <>
      <div className="mb-3 mt-7 flex items-baseline justify-between">
        <h3 className="text-meta font-semibold">眉批</h3>
        {annotations.length > 0 && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {annotations.length}
          </span>
        )}
      </div>
      {annotations.length === 0 ? (
        <p className="text-muted-foreground text-meta leading-[1.6]">
          還沒有眉批。把游標移到訊息上，按「眉批」就能加一則。
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {ordered.map(({ a, i }) => (
            <AnnotationItem
              key={`${i}-${a.eventId}`}
              annotation={a}
              {...rest}
              reattaching={reattach === i}
              textareaRef={(el) => {
                refs.current[i] = el;
              }}
              onBody={(body) => onBody(i, body)}
              onReattach={() => onReattach(i)}
              onDelete={() => onDelete(i)}
            />
          ))}
        </ul>
      )}
    </>
  );
}
