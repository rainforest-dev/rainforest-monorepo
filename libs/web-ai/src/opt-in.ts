export function optInSwitch(key: string) {
  return {
    read(storage: Pick<Storage, 'getItem'> | undefined): boolean {
      try {
        return storage?.getItem(key) === '1';
      } catch {
        return false;
      }
    },
    write(
      storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined,
      on: boolean,
    ): void {
      try {
        if (on) storage?.setItem(key, '1');
        else storage?.removeItem(key);
      } catch {
        return;
      }
    },
  };
}
