'use client';
import type { Liff } from '@line/liff';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

const isDev = process.env.NODE_ENV === 'development';

const LiffContext = createContext<{
  liff: Liff | null;
  liffError: string | null;
}>({
  liff: null,
  liffError: null,
});

export const useLiff = () => useContext(LiffContext);

export default function LiffProvider({
  liffId,
  children,
}: PropsWithChildren<{ liffId: string }>) {
  const [liff, setLiff] = useState<Liff | null>(null);
  const [liffError, setLiffError] = useState<string | null>(null);

  const initLiff = useCallback(async () => {
    try {
      const liffModule = await import('@line/liff');
      const liff = liffModule.default;
      console.log('LIFF init...');
      if (isDev) {
        const { LiffMockPlugin } = await import('@line/liff-mock');
        liff.use(new LiffMockPlugin());
      }

      await liff.init({ liffId, mock: isDev });

      console.log('LIFF init succeeded.');
      setLiff(liff);
    } catch (error) {
      console.log('LIFF init failed.');
      setLiffError((error as Error).toString());
    }
  }, [liffId]);

  useEffect(() => {
    console.log('LIFF init start...');
    initLiff();
  }, [initLiff]);

  useEffect(() => {
    if (!liff) return;
    if (!liff.isLoggedIn()) {
      liff.login();
    }
  }, [liff]);

  return (
    <LiffContext.Provider value={{ liff, liffError }}>
      {children}
    </LiffContext.Provider>
  );
}
