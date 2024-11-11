import {
  applyTheme as _applyTheme,
  argbFromHex,
  hexFromArgb,
  type Scheme,
  themeFromSourceColor,
} from '@material/material-color-utilities';
import Cookies from 'js-cookie';
import _plugin from 'tailwindcss/plugin';

import { defaultSourceColor } from './constants';

interface IOptions {
  sourceColor?: string;
  dark?: boolean;
}

export const getSchemeProperties = (scheme: Scheme) => {
  const properties = Object.fromEntries(
    Object.entries(scheme.toJSON()).map(([key, value]) => {
      // reference: https://github.com/material-foundation/material-color-utilities/blob/ca894db8b6aebb2833f1805ae61573c92e3f1660/typescript/utils/theme_utils.ts#L181
      const token = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      const color = hexFromArgb(value);
      return [`--md-sys-color-${token}`, color];
    })
  );
  return properties;
};

export default _plugin.withOptions(
  ({ sourceColor = defaultSourceColor, dark = false }: IOptions = {}) => {
    console.log(Cookies.get('source-color'));
    const theme = themeFromSourceColor(argbFromHex(sourceColor));
    const scheme = dark ? theme.schemes.dark : theme.schemes.light;
    const properties = Object.fromEntries(
      Object.entries(scheme.toJSON()).map(([key, value]) => {
        // reference: https://github.com/material-foundation/material-color-utilities/blob/ca894db8b6aebb2833f1805ae61573c92e3f1660/typescript/utils/theme_utils.ts#L181
        const token = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        const color = hexFromArgb(value);
        return [`--md-sys-color-${token}`, color];
      })
    );
    return ({ addBase }) => {
      addBase({ ':root': properties });
    };
  }
) as ReturnType<typeof _plugin.withOptions>;

export const applyTheme = (sourceColor: string, dark: boolean) => {
  const theme = themeFromSourceColor(argbFromHex(sourceColor));
  console.log(theme.palettes);
  _applyTheme(theme, {
    target: document.documentElement,
    dark,
    paletteTones: [],
  });
};
