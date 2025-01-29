import { argbFromHex } from '@material/material-color-utilities';
import plugin from 'tailwindcss/plugin';

import {
  getColorRoles,
  getSchemeProperties,
  schemePropertiesToCssInJs,
  themeFromSourceColor,
} from '../utils/theme.js';

interface IOptions {
  sourceColor?: string;
}

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
        extend: {
          colors,
        },
      },
    };
  }
) as ReturnType<typeof plugin.withOptions>;
