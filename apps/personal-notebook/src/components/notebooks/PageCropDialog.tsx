'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Spinner,
  Switch,
  toast,
} from '@rainforest-dev/rainforest-react';
import { RotateCcw } from 'lucide-react';
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useId,
  useRef,
  useState,
} from 'react';

import {
  defaultSeam,
  isConvexQuad,
  type Point,
  type Quad,
  type Seam,
  splitSpread,
  SPREAD_ASPECT,
} from '@/lib';
import { NOTEBOOK_NAMESPACE } from '@/locales';

import { cropPages, detectNormalisedQuad, drawScaled } from './crop-image';

/** One picked image waiting for its crop. */
export interface CropRequest {
  file: File;
  bitmap: ImageBitmap;
  index: number;
  total: number;
}

export type CropOutcome =
  { kind: 'pages'; files: File[] } | { kind: 'skip' } | { kind: 'cancel' };

/** Long edge of the on-screen preview; the crop itself reads the full image. */
const PREVIEW_EDGE = 1600;

type HandleKey = 0 | 1 | 2 | 3 | 'seamTop' | 'seamBottom';

const CORNER_KEYS = [
  'crop.corner.0',
  'crop.corner.1',
  'crop.corner.2',
  'crop.corner.3',
] as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

interface Outline {
  quad: Quad;
  spread: boolean;
  seam: Seam;
}

/** The detected outline, opening as a spread when it is clearly landscape. */
function initialOutline(bitmap: ImageBitmap): Outline {
  const quad = detectNormalisedQuad(bitmap);
  const [tl, tr, br, bl] = quad;
  const width =
    (Math.hypot(tr.x - tl.x, tr.y - tl.y) +
      Math.hypot(br.x - bl.x, br.y - bl.y)) *
    bitmap.width;
  const height =
    (Math.hypot(bl.x - tl.x, bl.y - tl.y) +
      Math.hypot(br.x - tr.x, br.y - tr.y)) *
    bitmap.height;
  return {
    quad,
    spread: width > height * SPREAD_ASPECT,
    seam: defaultSeam(quad),
  };
}

const svgPoints = (points: readonly Point[]) =>
  points.map((p) => `${p.x},${p.y}`).join(' ');

/**
 * Crops each picked photo before upload: the detected page outline with four draggable corners,
 * and for a spread a draggable seam that splits it into a left and a right page.
 */
export function PageCropDialog({
  request,
  onResolve,
}: {
  request: CropRequest | null;
  onResolve: (outcome: CropOutcome) => void;
}) {
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onResolve({ kind: 'cancel' });
      }}
    >
      <DialogContent className="max-h-[96dvh] overflow-y-auto sm:max-w-3xl">
        {request && (
          <CropEditor
            key={request.index}
            request={request}
            onResolve={onResolve}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CropEditor({
  request,
  onResolve,
}: {
  request: CropRequest;
  onResolve: (outcome: CropOutcome) => void;
}) {
  const spreadId = useId();
  const t = useLibraryT(NOTEBOOK_NAMESPACE);
  const frame = useRef<HTMLDivElement>(null);
  const [detected] = useState(() => initialOutline(request.bitmap));
  const [outline, setOutline] = useState(detected);
  const [busy, setBusy] = useState(false);
  const { bitmap } = request;
  const drawPreview = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (canvas) drawScaled(bitmap, PREVIEW_EDGE, canvas);
    },
    [bitmap],
  );

  const pages: Quad[] = outline.spread
    ? splitSpread(outline.quad, outline.seam)
    : [outline.quad];
  const valid = pages.every(isConvexQuad);

  function move(key: HandleKey, to: Point) {
    const point = { x: clamp01(to.x), y: clamp01(to.y) };
    setOutline((current) => {
      if (key === 'seamTop')
        return { ...current, seam: [point, current.seam[1]] };
      if (key === 'seamBottom')
        return { ...current, seam: [current.seam[0], point] };
      const quad = [...current.quad] as [Point, Point, Point, Point];
      quad[key] = point;
      return { ...current, quad };
    });
  }

  const positionOf = (key: HandleKey): Point =>
    key === 'seamTop'
      ? outline.seam[0]
      : key === 'seamBottom'
        ? outline.seam[1]
        : outline.quad[key];

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
  }

  function onPointerMove(
    event: PointerEvent<HTMLButtonElement>,
    key: HandleKey,
  ) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const rect = frame.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    move(key, {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, key: HandleKey) {
    const step = event.shiftKey ? 0.02 : 0.004;
    const delta: Partial<Record<string, [number, number]>> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const by = delta[event.key];
    if (!by) return;
    event.preventDefault();
    const at = positionOf(key);
    move(key, { x: at.x + by[0], y: at.y + by[1] });
  }

  function setSpread(spread: boolean) {
    setOutline((current) => ({
      ...current,
      spread,
      seam: spread ? defaultSeam(current.quad) : current.seam,
    }));
  }

  async function confirm() {
    if (!valid) return;
    setBusy(true);
    // Let the spinner paint first: the warp runs on this thread.
    await new Promise((resolve) =>
      requestAnimationFrame(() => setTimeout(resolve)),
    );
    try {
      const files = await cropPages(bitmap, pages, request.file.name);
      onResolve({ kind: 'pages', files });
    } catch {
      toast.error(t('crop.failed'));
      onResolve({ kind: 'skip' });
    } finally {
      setBusy(false);
    }
  }

  const handles: HandleKey[] = outline.spread
    ? [0, 1, 2, 3, 'seamTop', 'seamBottom']
    : [0, 1, 2, 3];

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {t('crop.title')}
          {request.total > 1 && (
            <span className="text-muted-foreground font-normal">
              {' · '}
              {t('crop.progress', {
                index: request.index + 1,
                total: request.total,
              })}
            </span>
          )}
        </DialogTitle>
        <DialogDescription>{t('crop.hint')}</DialogDescription>
      </DialogHeader>

      <div className="bg-muted flex justify-center rounded-md p-2">
        <div ref={frame} className="relative w-fit" data-crop-frame>
          <canvas
            ref={drawPreview}
            role="img"
            aria-label={t('crop.photo', { name: request.file.name })}
            className="block h-auto max-h-[58dvh] w-auto max-w-full select-none"
          />
          <svg
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 size-full"
            aria-hidden
          >
            <path
              d={`M0,0H1V1H0Z M${svgPoints(outline.quad).replaceAll(' ', 'L')}Z`}
              fillRule="evenodd"
              className="fill-background/60"
            />
            {pages.map((quad, i) => (
              <polygon
                key={i}
                points={svgPoints(quad)}
                vectorEffect="non-scaling-stroke"
                className={valid ? 'stroke-primary' : 'stroke-destructive'}
                fill="none"
                strokeWidth={2}
              />
            ))}
          </svg>
          {handles.map((key) => {
            const at = positionOf(key);
            const seam = typeof key === 'string';
            return (
              <button
                key={key}
                type="button"
                aria-label={
                  key === 'seamTop'
                    ? t('crop.seamTop')
                    : key === 'seamBottom'
                      ? t('crop.seamBottom')
                      : t(CORNER_KEYS[key])
                }
                data-handle={key}
                onPointerDown={onPointerDown}
                onPointerMove={(event) => onPointerMove(event, key)}
                onKeyDown={(event) => onKeyDown(event, key)}
                style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
                className="focus-visible:outline-ring absolute flex size-11 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-full outline-offset-0 focus-visible:outline-2 active:cursor-grabbing"
              >
                <span
                  className={
                    seam
                      ? 'bg-background border-primary size-4 rotate-45 rounded-sm border-2 shadow'
                      : 'bg-primary border-primary-foreground size-4 rounded-full border-2 shadow'
                  }
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id={spreadId}
            checked={outline.spread}
            onCheckedChange={(next) => setSpread(next)}
          />
          <Label htmlFor={spreadId} className="font-normal">
            {t('crop.spread')}
          </Label>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOutline(detected)}>
          <RotateCcw aria-hidden />
          {t('crop.reset')}
        </Button>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => onResolve({ kind: 'skip' })}
        >
          {t('crop.skip')}
        </Button>
        <Button disabled={busy || !valid} onClick={() => void confirm()}>
          {busy && <Spinner />}
          {outline.spread ? t('crop.two') : t('crop.title')}
        </Button>
      </DialogFooter>
    </>
  );
}
