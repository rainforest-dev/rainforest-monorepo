import { persistentAtom } from '@nanostores/persistent';

export const sourceColor = persistentAtom<string>('source-color', '#66b2b2');
