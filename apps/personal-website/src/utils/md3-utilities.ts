import _plugin from 'tailwindcss/plugin';
import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
  applyTheme as _applyTheme,
  type Scheme,
} from '@material/material-color-utilities';
import Cookies from 'js-cookie';
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
    console.log(properties);
    return ({ addBase }) => {
      addBase({ ':root': properties });
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