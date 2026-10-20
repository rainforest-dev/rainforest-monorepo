/**
 * Where the reader stood in the hall and what it looked like, kept for one tab. A Back that the
 * bfcache serves restores the live scene and never reads this; when the browser rebuilds the
 * page instead, the hall starts at the saved spot and shows the saved picture until the first
 * real frame is drawn.
 */
export interface HallMemory {
  href: string;
  at: number;
  x: number;
  z: number;
  heading: number;
  /** A small JPEG data URL of the last frame, or `null` if capturing failed. */
  poster: string | null;
}

const KEY = 'library-hall:memory';
/** Older than this and the room has likely changed; start fresh. */
const MAX_AGE_MS = 30 * 60 * 1000;
export const POSTER_WIDTH = 480;

const here = () => window.location.pathname + window.location.search;

function isMemory(value: unknown): value is HallMemory {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m['href'] === 'string' &&
    typeof m['at'] === 'number' &&
    typeof m['x'] === 'number' &&
    typeof m['z'] === 'number' &&
    typeof m['heading'] === 'number' &&
    (m['poster'] === null ||
      (typeof m['poster'] === 'string' &&
        m['poster'].startsWith('data:image/')))
  );
}

export function readHallMemory(now = Date.now()): HallMemory | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isMemory(value)) return null;
    if (value.href !== here() || now - value.at > MAX_AGE_MS) return null;
    return value;
  } catch {
    return null;
  }
}

export function writeHallMemory(memory: Omit<HallMemory, 'href' | 'at'>): void {
  const value: HallMemory = { ...memory, href: here(), at: Date.now() };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Over quota with the picture: keep the position, which is what matters most.
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ ...value, poster: null }));
    } catch {
      // Blocked storage: the hall simply starts at the entrance.
    }
  }
}

/** A downscaled copy of a canvas the caller has just drawn into, as a JPEG data URL. */
export function capturePoster(source: HTMLCanvasElement): string | null {
  if (source.width === 0 || source.height === 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH;
  canvas.height = Math.round((source.height * POSTER_WIDTH) / source.width);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch {
    return null;
  }
}
