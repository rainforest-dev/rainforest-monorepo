import shadcn from './shadcn.js';

type Api = Parameters<ReturnType<typeof shadcn>['handler']>[0];
type Block = Record<string, string>;

const FALLBACK = '@supports not (color: oklch(from red l c h))';
const DARK = "[data-scheme='dark']";
const RELATIVE = /^oklch\(from var\(--seed\) ([\d.]+) ([\d.]+) h\)$/;
const PAIR = ['--primary', '--primary-foreground'] as const;

function baseStyles(): Record<string, unknown> {
  const bases: Record<string, unknown>[] = [];
  const api = {
    addBase: (base: Record<string, unknown>) => {
      bases.push(base);
    },
  } as unknown as Api;
  shadcn().handler(api);
  const [first] = bases;
  if (!first) throw new Error('the plugin added no base styles');
  return first;
}

function token(block: Block, name: string): string {
  const value = block[name];
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toGamma = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * toLinear(r / 255) +
    0.7152 * toLinear(g / 255) +
    0.0722 * toLinear(b / 255)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

function hue(hex: string): number {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = toLinear(r8 / 255);
  const g = toLinear(g8 / 255);
  const b = toLinear(b8 / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
}

// Browsers clip an out-of-gamut oklch() per sRGB channel instead of reducing chroma.
function oklchToHex(L: number, C: number, h: number): string {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb
    .map((c) =>
      Math.round(Math.min(1, toGamma(Math.max(0, c))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function resolve(value: string, seed: string): string {
  const match = RELATIVE.exec(value);
  if (!match) throw new Error(`not a seed-relative colour: ${value}`);
  return oklchToHex(Number(match[1]), Number(match[2]), hue(seed));
}

function channelDistance(a: string, b: string): number {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return Math.max(...x.map((c, i) => Math.abs(c - (y[i] ?? 0))));
}

const base = baseStyles();
const schemes: Array<[string, Block, Block]> = [
  [
    'light',
    base[':root'] as Block,
    (base[FALLBACK] as Record<string, Block>)[':root'] as Block,
  ],
  [
    'dark',
    base[DARK] as Block,
    (base[FALLBACK] as Record<string, Block>)[DARK] as Block,
  ],
];

describe('primary contrast', () => {
  describe.each(schemes)('%s', (_scheme, relative, fallback) => {
    it.each(['#66b2b2', '#7c5cff', '#e0784a'])(
      'resolves --primary on --primary-foreground to at least 4.5:1 with seed %s',
      (seed) => {
        const [primary, foreground] = PAIR.map((name) =>
          resolve(token(relative, name), seed),
        ) as [string, string];
        expect(contrast(primary, foreground)).toBeGreaterThanOrEqual(4.5);
      },
    );

    it('keeps the fallback pair at 4.5:1 or more', () => {
      expect(
        contrast(
          token(fallback, '--primary'),
          token(fallback, '--primary-foreground'),
        ),
      ).toBeGreaterThanOrEqual(4.5);
    });

    it.each(PAIR)('pre-resolves %s from the default seed', (name) => {
      expect(
        channelDistance(
          token(fallback, name),
          resolve(token(relative, name), '#66b2b2'),
        ),
      ).toBeLessThanOrEqual(1);
    });
  });
});
