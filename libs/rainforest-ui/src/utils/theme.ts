import {
  clampDouble,
  type DynamicScheme,
  Hct,
  hexFromArgb,
  SchemeContent,
  SchemeExpressive,
  SchemeFidelity,
  SchemeFruitSalad,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeRainbow,
  SchemeTonalSpot,
  SchemeVibrant,
  type TonalPalette,
} from '@material/material-color-utilities';

export enum Variant {
  MONOCHROME,
  NEUTRAL,
  TONAL_SPOT,
  VIBRANT,
  EXPRESSIVE,
  FIDELITY,
  CONTENT,
  RAINBOW,
  FRUIT_SALAD,
}

export interface Theme {
  source: Hct;
  schemes: {
    light: DynamicScheme;
    dark: DynamicScheme;
  };
  palettes: {
    primary: TonalPalette;
    secondary: TonalPalette;
    tertiary: TonalPalette;
    neutral: TonalPalette;
    neutralVariant: TonalPalette;
    error: TonalPalette;
  };
}

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

export const getColorRoles = () => {
  let roles: { [key: string]: string } = {};

  const toKebabCase = (...args: string[]) => {
    return args.map((word) => word.toLowerCase()).join('-');
  };
  const toLowerCamelCase = (...args: string[]) => {
    return args
      .map((word, index) => {
        word = word.toLowerCase();
        if (index === 0) return word;
        return `${word[0].toUpperCase()}${word.slice(1)}`;
      })
      .join('');
  };

  for (const role of ['primary', 'secondary', 'tertiary', 'error']) {
    roles[role] = role;
    roles[toKebabCase('on', role)] = toLowerCamelCase('on', role);
    roles[toKebabCase(role, 'container')] = toLowerCamelCase(role, 'container');
    roles[toKebabCase('on', role, 'container')] = toLowerCamelCase(
      'on',
      role,
      'container'
    );
  }
  for (const role of ['primary', 'secondary', 'tertiary']) {
    roles[toKebabCase(role, 'fixed')] = toLowerCamelCase(role, 'fixed');
    roles[toKebabCase(role, 'fixed', 'dim')] = toLowerCamelCase(
      role,
      'fixed',
      'dim'
    );
    roles[toKebabCase('on', role, 'fixed')] = toLowerCamelCase(
      'on',
      role,
      'fixed'
    );
    roles[toKebabCase('on', role, 'fixed', 'variant')] = toLowerCamelCase(
      'on',
      role,
      'fixed',
      'variant'
    );
  }
  roles = {
    ...roles,
    'surface-dim': 'surfaceDim',
    surface: 'surface',
    'surface-bright': 'surfaceBright',
    'surface-container-lowest': 'surfaceContainerLowest',
    'surface-container-low': 'surfaceContainerLow',
    'surface-container': 'surfaceContainer',
    'surface-container-high': 'surfaceContainerHigh',
    'surface-container-highest': 'surfaceContainerHighest',
    'on-surface': 'onSurface',
    'on-surface-variant': 'onSurfaceVariant',
    outline: 'outline',
    'outline-variant': 'outlineVariant',
    'inverse-surface': 'inverseSurface',
    'inverse-on-surface': 'inverseOnSurface',
    'inverse-primary': 'inversePrimary',
    scrim: 'scrim',
    shadow: 'shadow',
  };
  return roles;
};

export const getSchemeProperties = (
  scheme: DynamicScheme,
  prefix = '--md-sys-color-'
) => {
  const roles = getColorRoles();

  const isSchemeKey = (key: string): key is keyof typeof scheme =>
    key in scheme;

  return Object.fromEntries(
    Object.entries(roles).reduce((acc, [key, value]) => {
      if (isSchemeKey(value)) {
        const schemeValue = scheme[value];
        // check if the value is number
        if (typeof schemeValue === 'number') {
          acc.push([`${prefix}${key}`, schemeValue]);
        }
      }
      return acc;
    }, [] as [string, number][])
  );
};

export interface IApplyThemeOptions {
  dark?: boolean;
  target?: HTMLElement;
}

export const applyTheme = (theme: Theme, options?: IApplyThemeOptions) => {
  const target = options?.target || document.body;
  const dark = options?.dark ?? false;

  const scheme = dark ? theme.schemes.dark : theme.schemes.light;
  for (const [key, palette] of Object.entries(getSchemeProperties(scheme))) {
    target.style.setProperty(key, hexFromArgb(palette));
  }
};
