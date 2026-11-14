const VAR = /^var\((--[\w-]+)\)$/;

export function resolveColor(value: string, root: Element): string {
  const name = VAR.exec(value.trim())?.[1];
  return name ? getComputedStyle(root).getPropertyValue(name).trim() : value;
}

export function hexToRgb(hex: string): [number, number, number] | undefined {
  const m = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(hex.trim());
  if (!m?.[1]) return undefined;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;
}

export const FRAME_MS = { desktop: 1000 / 60, phone: 1000 / 30 } as const;

export function approach(
  current: number,
  target: number,
  dt: number,
  rate = 4,
) {
  return current + (target - current) * Math.min(1, dt * rate);
}
