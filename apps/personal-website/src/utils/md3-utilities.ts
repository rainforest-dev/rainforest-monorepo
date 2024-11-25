import { argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import {
  applyTheme as _applyTheme,
  getColorRoles,
  getSchemeProperties,
  themeFromSourceColor,
} from '@rainforest-dev/rainforest-ui';
import _plugin from 'tailwindcss/plugin';

interface IOptions {
  sourceColor?: string;
  dark?: boolean;
}

export default _plugin.withOptions(
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
  (_: IOptions = {}) => {
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
) as ReturnType<typeof _plugin.withOptions>;

export const applyTheme = (sourceColor: string, dark: boolean) => {
  const theme = themeFromSourceColor(argbFromHex(sourceColor));
  _applyTheme(theme, {
    target: document.documentElement,
    dark,
  });
};
