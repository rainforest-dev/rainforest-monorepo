import { argbFromHex } from '@material/material-color-utilities';
import {
  applyTheme as _applyTheme,
  themeFromSourceColor,
} from '@rainforest-dev/rainforest-ui';

export const applyTheme = (sourceColor: string, dark: boolean) => {
  const theme = themeFromSourceColor(argbFromHex(sourceColor));
  _applyTheme(theme, {
    target: document.documentElement,
    dark,
  });
};
