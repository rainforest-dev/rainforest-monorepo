import { useState } from 'react';

import { type FeedResult, validateFeed } from '@/lib/desk';

export interface FeedValidation {
  url: string;
  setUrl: (url: string) => void;
  pending: boolean;
  result: FeedResult | null;
  validate: () => Promise<void>;
}

export function useFeedValidation(initialUrl = ''): FeedValidation {
  const [url, setUrl] = useState(initialUrl);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<FeedResult | null>(null);

  async function validate() {
    const target = url.trim();
    if (!target || pending) return;
    setPending(true);
    setResult(null);
    try {
      setResult(await validateFeed(target));
    } catch (err) {
      setResult({
        valid: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setPending(false);
    }
  }

  return { url, setUrl, pending, result, validate };
}
