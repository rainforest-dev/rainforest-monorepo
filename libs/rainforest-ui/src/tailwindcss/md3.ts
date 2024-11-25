import { argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import plugin from 'tailwindcss/plugin';

import {
  getColorRoles,
  getSchemeProperties,
  themeFromSourceColor,
} from '../utils/theme.js';

interface IOptions {
  sourceColor?: string;
  dark?: boolean;
}

export default plugin.withOptions(
  ({ sourceColor = '#66b2b2', dark = false }: IOptions = {}) => {
    const theme = themeFromSourceColor(argbFromHex(sourceColor));
    const scheme = dark ? theme.schemes.dark : theme.schemes.light;
    const properties = Object.fromEntries(
      Object.entries(getSchemeProperties(scheme)).map(([key, value]) => {
        const color = hexFromArgb(value);
        return [key, color];
      })
    );
    return ({ addBase }) => {
      addBase({ ':root': properties });
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
