import {
  persistentAtom,
  type PersistentEvents,
  type PersistentListener,
  setPersistentEngine,
} from '@nanostores/persistent';
import { defaultSourceColor } from '@utils/constants';
import Cookies from 'js-cookie';

let listeners: PersistentListener[] = [];
const onChange = (key: string, newValue: string) => {
  const event = { key, newValue };
  for (const listener of listeners) listener(event);
};

const storage = new Proxy(
  {},
  {
    set(_, name: string, value) {
      Cookies.set(name, value);
      onChange(name, value);
      return true;
    },
    get(_, name: string) {
      return Cookies.get(name);
    },
    deleteProperty(_, name: string) {
      Cookies.remove(name);
      onChange(name, '');
      return true;
    },
  }
);

const events: PersistentEvents = {
  addEventListener(_, cb) {
    listeners.push(cb);
  },
  removeEventListener(_, cb) {
    listeners = listeners.filter((i) => i !== cb);
  },
  perKey: false,
};

setPersistentEngine(storage, events);

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
export const $sourceColor = persistentAtom<string>(
  persistentKey,
  defaultSourceColor
);
