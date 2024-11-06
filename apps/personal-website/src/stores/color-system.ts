import { persistentAtom } from '@nanostores/persistent';
import { defaultSourceColor } from '@utils/constants';
import Cookies from 'js-cookie';

export const persistentColorSchemeKey = 'dark';
export const colorScheme = persistentAtom<boolean>(
  persistentColorSchemeKey,
  Boolean(Cookies.get(persistentColorSchemeKey)),
  {
    encode: JSON.stringify,
    decode: JSON.parse,
  }
);
export const updateColorScheme = (scheme: boolean) => {
  colorScheme.set(scheme);
  Cookies.set(persistentColorSchemeKey, String(scheme));
};

export const persistentKey = 'source-color';
export const sourceColor = persistentAtom<string>(
  persistentKey,
  Cookies.get(persistentKey) ?? defaultSourceColor
);
export const updateSourceColor = (color: string) => {
  sourceColor.set(color);
  Cookies.set(persistentKey, color);
};
