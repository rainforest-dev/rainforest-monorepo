/** A collection colour softened toward `--muted`, so spines follow the light or dark scheme. */
export function spineColor(hex: string, share = 55): string {
  return `color-mix(in oklch, ${hex} ${share}%, var(--muted))`;
}

/** The colour as an sRGB triple, for the 3D scenes. Shorthand and alpha forms are accepted. */
export function hexToRgb(hex: string): readonly [number, number, number] {
  let h = hex.replace(/^#/, '');
  if (h.length === 3 || h.length === 4)
    h = [...h.slice(0, 3)].map((c) => c + c).join('');
  const n = Number.parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
