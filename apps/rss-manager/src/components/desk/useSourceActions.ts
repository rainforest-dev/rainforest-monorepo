import { useState } from 'react';

import { patchRegistry, type Source } from '@/lib';

export type SourceAction = 'activate' | 'retire';

export interface SourceActionsState {
  writable: boolean;
  pending: ReadonlySet<string>;
  copied: string | null;
  error: string | null;
  run: (name: string, action: SourceAction) => Promise<void>;
  copyFeedUrl: (name: string, url: string) => Promise<void>;
}

const NEXT_STATUS: Record<SourceAction, Source['status']> = {
  activate: 'active',
  retire: 'retired',
};

export function useSourceActions({
  writable,
  onSourcesChange,
  onReadOnly,
}: {
  writable: boolean;
  onSourcesChange: (update: (prev: Source[]) => Source[]) => void;
  onReadOnly: () => void;
}): SourceActionsState {
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setBusy(name: string, busy: boolean) {
    setPending((prev) => {
      const next = new Set(prev);
      if (busy) next.add(name);
      else next.delete(name);
      return next;
    });
  }

  async function run(name: string, action: SourceAction) {
    if (pending.has(name)) return;
    setBusy(name, true);
    setError(null);
    try {
      const result = await patchRegistry('/api/sources', name, action);
      if (!result.ok) {
        if (result.readOnly) onReadOnly();
        else setError(result.error);
        return;
      }
      onSourcesChange((prev) =>
        prev.map((s) =>
          s.name === name ? { ...s, status: NEXT_STATUS[action] } : s,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(name, false);
    }
  }

  async function copyFeedUrl(name: string, url: string) {
    if (!url) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(name);
      window.setTimeout(
        () => setCopied((current) => (current === name ? null : current)),
        3000,
      );
    } catch {
      setError(`Could not copy the feed URL — paste it by hand: ${url}`);
    }
  }

  return { writable, pending, copied, error, run, copyFeedUrl };
}
