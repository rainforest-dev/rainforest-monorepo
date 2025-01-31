import { argbFromHex } from '@material/material-color-utilities';
import typographyPlugin from '@tailwindcss/typography';
import plugin from 'tailwindcss/plugin';

import {
  getColorRoles,
  getSchemeProperties,
  schemePropertiesToCssInJs,
  themeFromSourceColor,
} from '../utils/theme.js';

interface IOptions {
  sourceColor?: string;
  modules?: {
    colors?:
      | {
          enabled: boolean;
          addDefaultTheme: boolean;
        }
      | boolean;
    typography?: boolean;
  };
}

export default plugin.withOptions(
  ({
    sourceColor = '#66b2b2',
    modules: { colors = true } = {},
  }: IOptions = {}) => {
    const theme = themeFromSourceColor(argbFromHex(sourceColor));
    return (params) => {
      const { addBase } = params;
      if (
        typeof colors === 'boolean'
          ? colors
          : colors.enabled && colors.addDefaultTheme
      ) {
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
      }
    };
  },
  ({
    modules: { colors: colorsModule = true, typography = true } = {},
  }: IOptions = {}) => {
    const roles = getColorRoles();
    const colors = Object.fromEntries(
      Object.entries(roles).map(([key]) => [key, `var(--md-sys-color-${key})`])
    );
    return {
      theme: {
        extend: {
          colors: (
            typeof colorsModule === 'boolean'
              ? colorsModule
              : colorsModule?.enabled
          )
            ? colors
            : undefined,
          typography: () => ({
            DEFAULT: {
              css: {
                '--tw-prose-headings': 'var(--md-sys-color-primary)',
                '--tw-prose-body': 'var(--md-sys-color-on-surface)',
                '--tw-prose-links': 'var(--md-sys-color-tertiary)',
                '--tw-prose-hr': 'var(--md-sys-color-outline-variant)',
                '--tw-prose-code': 'var(--md-sys-color-primary)',
                '--tw-prose-pre-code':
                  'var(--md-sys-color-on-primary-container)',
                '--tw-prose-pre-bg': 'var(--md-sys-color-primary-container)',
              },
            },
          }),
        },
      },
      plugins: [...(typography ? [typographyPlugin] : [])],
    };
  }
) as ReturnType<typeof plugin.withOptions>;
