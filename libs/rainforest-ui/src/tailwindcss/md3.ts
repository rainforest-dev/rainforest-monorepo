import {
  argbFromHex,
  type DynamicScheme,
  hexFromArgb,
} from '@material/material-color-utilities';
import plugin from 'tailwindcss/plugin';

import {
  getColorRoles,
  getSchemeProperties,
  themeFromSourceColor,
} from '../utils/theme.js';

interface IOptions {
  sourceColor?: string;
}

export default plugin.withOptions(
  ({ sourceColor = '#66b2b2' }: IOptions = {}) => {
    const theme = themeFromSourceColor(argbFromHex(sourceColor));
    const getProperties = (scheme: DynamicScheme) =>
      Object.fromEntries(
        Object.entries(getSchemeProperties(scheme)).map(([key, value]) => {
          const color = hexFromArgb(value);
          return [key, color];
        })
      );
    return ({ addBase }) => {
      addBase({
        '@media (prefers-color-scheme: light)': {
          ':root': getProperties(theme.schemes.light),
        },
        '@media (prefers-color-scheme: dark)': {
          ':root': getProperties(theme.schemes.dark),
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
