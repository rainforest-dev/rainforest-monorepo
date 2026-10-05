import { Color, SRGBColorSpace } from 'three';

export type Rgb = readonly [number, number, number];

export const TOKEN_NAMES = [
  'background',
  'card',
  'muted',
  'muted-foreground',
  'foreground',
  'primary',
  'border',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
] as const;

export type Tokens = Record<(typeof TOKEN_NAMES)[number], Rgb>;

export function readTokens(): Tokens {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.append(probe);
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const read = (name: string): Rgb => {
    if (!ctx) return [0, 0, 0];
    probe.style.color = `var(--${name})`;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = getComputedStyle(probe).color;
    ctx.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  };
  const tokens = Object.fromEntries(
    TOKEN_NAMES.map((name) => [name, read(name)]),
  ) as Tokens;
  probe.remove();
  return tokens;
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    a[0] * t + b[0] * (1 - t),
    a[1] * t + b[1] * (1 - t),
    a[2] * t + b[2] * (1 - t),
  ];
}

export function toColor([r, g, b]: Rgb): Color {
  return new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
}
