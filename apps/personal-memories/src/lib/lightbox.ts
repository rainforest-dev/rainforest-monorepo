export const DATA_LIGHTBOX_READY = 'data-lightbox-ready';

export type LightboxItem = {
  id: string;
  at: string;
  alt: string;
  width?: number | undefined;
  height?: number | undefined;
  video: boolean;
};

export type LightboxRequest = {
  date: string;
  items: LightboxItem[];
  index: number;
  autoCover?: string | undefined;
};

const positive = (raw: string | undefined) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function itemFromDataset(
  d: Readonly<Record<string, string | undefined>>,
): LightboxItem | undefined {
  const id = d['eventId'];
  const at = d['at'];
  if (!id || !at) return undefined;
  return {
    id,
    at,
    alt: d['excerpt'] ?? '',
    width: positive(d['width']),
    height: positive(d['height']),
    video: d['video'] !== undefined,
  };
}

export const stepIndex = (index: number, count: number, delta: number) =>
  Math.min(Math.max(index + delta, 0), Math.max(count - 1, 0));

export function swipeDelta(dx: number, dy: number, min = 48): -1 | 0 | 1 {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

export const positionLabel = (index: number, count: number) =>
  `照片 · ${index + 1} / ${count}`;

export type CoverControl = 'hidden' | 'loading' | 'manual' | 'auto' | 'other';

export function coverControl(o: {
  writable: boolean;
  loaded: boolean;
  item: LightboxItem;
  cover: string | undefined;
  coverOnDay: boolean;
  autoCover: string | undefined;
}): CoverControl {
  if (!o.writable || o.item.video) return 'hidden';
  if (!o.loaded) return 'loading';
  if (o.cover === o.item.id) return 'manual';
  if ((!o.cover || !o.coverOnDay) && o.autoCover === o.item.id) return 'auto';
  return 'other';
}
