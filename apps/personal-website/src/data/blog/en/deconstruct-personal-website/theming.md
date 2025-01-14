---
title: 'Theming with Tailwind CSS V4 Beta and Material Design 3'
pubDate: '2024-12-20'
description: 'Theming with Tailwind CSS V4 Beta and Material Design 3.'
author: rainforest
image:
  src: '/assets/theming.png'
  alt: 'Theming'
tags:
  - 'series:deconstruct-personal-website'
  - 'tailwindcss'
  - 'material-design'
  - 'astro'
---

# Theming with Tailwind CSS V4 Beta and Material Design 3

## Get Theme

### From Source Color

```ts
import { SchemeMonochrome, ... } from '@material/material-color-utilities';
export const constructors = {
  [Variant.MONOCHROME]: SchemeMonochrome,
  [Variant.NEUTRAL]: SchemeNeutral,
  [Variant.TONAL_SPOT]: SchemeTonalSpot,
  [Variant.VIBRANT]: SchemeVibrant,
  [Variant.EXPRESSIVE]: SchemeExpressive,
  [Variant.FIDELITY]: SchemeFidelity,
  [Variant.CONTENT]: SchemeContent,
  [Variant.RAINBOW]: SchemeRainbow,
  [Variant.FRUIT_SALAD]: SchemeFruitSalad,
};

export const themeFromSourceColor = (
  sourceColorArgb: number,
  _variant: Variant = Variant.TONAL_SPOT,
  _contrastLevel = 0.0
): Theme => {
  const sourceColorHct = Hct.fromInt(sourceColorArgb);
  const variant = _variant in Variant ? _variant : Variant.TONAL_SPOT;
  const contrastLevel = clampDouble(-1.0, 1.0, _contrastLevel);
  const scheme = new constructors[variant](
    sourceColorHct,
    false,
    contrastLevel
  );
  const darkScheme = new constructors[variant](
    sourceColorHct,
    true,
    contrastLevel
  );

  return {
    source: sourceColorHct,
    schemes: {
      light: scheme,
      dark: darkScheme,
    },
    palettes: {
      primary: scheme.primaryPalette,
      secondary: scheme.secondaryPalette,
      tertiary: scheme.tertiaryPalette,
      neutral: scheme.neutralPalette,
      neutralVariant: scheme.neutralVariantPalette,
      error: scheme.errorPalette,
    },
  };
};
```

### From Image

```ts
export function sourceColorFromImageBytes(imageBytes: Uint8ClampedArray) {
  // Convert Image data to Pixel Array
  const pixels: number[] = [];
  for (let i = 0; i < imageBytes.length; i += 4) {
    const r = imageBytes[i];
    const g = imageBytes[i + 1];
    const b = imageBytes[i + 2];
    const a = imageBytes[i + 3];
    if (a < 255) {
      continue;
    }
    const argb = argbFromRgb(r, g, b);
    pixels.push(argb);
  }

  // Convert Pixels to Material Colors
  const result = QuantizerCelebi.quantize(pixels, 128);
  const ranked = Score.score(result);
  const top = ranked[0];
  return top;
}
```

```ts
const handleImageChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async () => {
      sourceImage.value = reader.result as string;

      const img = new Image();
      img.src = sourceImage.value;
      await new Promise((resolve) => (img.onload = resolve));
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const imageData = ctx?.getImageData(0, 0, img.width, img.height);
      if (!imageData) return;
      const argb = sourceColorFromImageBytes(imageData.data);
      const color = hexFromArgb(argb);
      if (color && color !== sourceColor.value) {
        sourceColor.value = color;
        reload();
      }
    };
    reader.readAsDataURL(file);
  }
};
```

## Tailwind CSS Plugin

```ts
export default plugin.withOptions(
  ({ sourceColor = '#66b2b2' }: IOptions = {}) => {
    const theme = themeFromSourceColor(argbFromHex(sourceColor));
    return ({ addBase }) => {
      addBase({
        '@media (prefers-color-scheme: light)': {
          ':root': schemePropertiesToCssInJs(
            getSchemeProperties(theme.schemes.light)
          ),
        },
        '@media (prefers-color-scheme: dark)': {
          ':root': schemePropertiesToCssInJs(
            getSchemeProperties(theme.schemes.dark)
          ),
        },
      });
    };
  },
  () => {
    const roles = getColorRoles();
    const colors = Object.fromEntries(
      Object.entries(roles).map(([key]) => [key, `var(--md-sys-color-${key})`])
    );
    return {
      theme: {
        colors,
      },
    };
  }
) as ReturnType<typeof plugin.withOptions>;
```

## Inject Theme from Server Side

```ts
const theme = themeFromSourceColor(argbFromHex(sourceColor));
const getSchemeStyles = (properties: { [key: string]: number }) => {
  return Object.entries(properties)
    .map(([k, v]) => `${k}: ${hexFromArgb(v)};`)
    .join('\n');
};
const lightSchemeStyles = getSchemeStyles(
  getSchemeProperties(theme.schemes.light)
);
const darkSchemeStyles = getSchemeStyles(
  getSchemeProperties(theme.schemes.dark)
);

const styleRaw = `
  @layer theme, base, components, utilities, app;
  @layer app {
    @media (prefers-color-scheme: light) {
      :root {
        ${lightSchemeStyles}
      }
    }
    @media (prefers-color-scheme: dark) {
      :root {
        ${darkSchemeStyles}
      }
    }
    [data-scheme='light'] {
      ${lightSchemeStyles}
    }
    [data-scheme='dark'] {
      ${darkSchemeStyles}
    }
  }
`;
```
