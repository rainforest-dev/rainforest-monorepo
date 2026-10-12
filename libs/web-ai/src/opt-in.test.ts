import { describe, expect, it } from 'vitest';

import { optInSwitch } from './opt-in';

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

describe('optInSwitch', () => {
  const sw = optInSwitch('k');

  it('is on only for a stored 1', () => {
    const storage = memoryStorage();
    storage.setItem('k', '1');
    expect(sw.read(storage)).toBe(true);
    storage.setItem('k', 'true');
    expect(sw.read(storage)).toBe(false);
    expect(sw.read(undefined)).toBe(false);
  });

  it('writes and clears, and survives blocked storage', () => {
    const storage = memoryStorage();
    sw.write(storage, true);
    expect(storage.getItem('k')).toBe('1');
    sw.write(storage, false);
    expect(storage.getItem('k')).toBeNull();
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(sw.read(blocked)).toBe(false);
    expect(() => sw.write(blocked, true)).not.toThrow();
  });
});
