export const PREVIEW_SHOW_MS = 300;
export const PREVIEW_HIDE_MS = 80;
export const PREVIEW_MOVE_PX = 8;
export const PREVIEW_MARGIN_PX = 8;

export type Box = { top: number; left: number; width: number; height: number };
export type Size = { width: number; height: number };

export const showDelay = (warm: boolean) => (warm ? 0 : PREVIEW_SHOW_MS);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

export function placePreview(
  cell: Box,
  preview: Size,
  viewport: Size,
): { top: number; left: number } {
  const m = PREVIEW_MARGIN_PX;
  const above = cell.top - m - preview.height;
  const top = above >= m ? above : cell.top + cell.height + m;
  return {
    top: clamp(top, m, viewport.height - preview.height - m),
    left: clamp(
      cell.left + cell.width / 2 - preview.width / 2,
      m,
      viewport.width - preview.width - m,
    ),
  };
}
