import type { Ref } from 'react';

import type { ResolvedAnnotation } from '../../lib/notes/attach.ts';
import { SOURCE_LABELS } from '../../lib/notes/types.ts';
import { taipeiTime } from '../../lib/weeks.ts';

type Props = {
  annotation: ResolvedAnnotation;
  disabled: boolean;
  reattaching: boolean;
  textareaRef: Ref<HTMLTextAreaElement>;
  onBody: (body: string) => void;
  onReattach: () => void;
  onDelete: () => void;
};

const BUTTON =
  'rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

export function AnnotationItem({
  annotation: a,
  disabled,
  reattaching,
  textareaRef,
  onBody,
  onReattach,
  onDelete,
}: Props) {
  const attached = a.status !== 'unattached';
  return (
    <li className="border-border space-y-1.5 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {[taipeiTime(a.at), SOURCE_LABELS[a.source], a.author].join(' · ')}
        </span>
        <button
          type="button"
          className={BUTTON}
          disabled={disabled}
          onClick={onDelete}
        >
          刪除
        </button>
      </div>
      {attached ? (
        <a
          href={`#ev-${a.eventId}`}
          className="text-muted-foreground line-clamp-2 block text-sm underline-offset-2 hover:underline"
        >
          {a.excerpt}
        </a>
      ) : (
        <div className="space-y-1">
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {a.excerpt}
          </p>
          <button
            type="button"
            className={BUTTON}
            disabled={disabled}
            onClick={onReattach}
          >
            重新連結
          </button>
          {reattaching && (
            <p className="text-muted-foreground text-xs">
              點一則訊息的眉批按鈕
            </p>
          )}
        </div>
      )}
      <textarea
        ref={textareaRef}
        aria-label={`眉批：${a.excerpt}`}
        value={a.body}
        disabled={disabled}
        rows={3}
        onChange={(e) => onBody(e.target.value)}
        className="border-input bg-background focus-visible:ring-ring w-full resize-y rounded-md border px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60"
      />
    </li>
  );
}
