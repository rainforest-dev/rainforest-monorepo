import { toast } from '@rainforest-dev/rainforest-react';
import { useRef, useState } from 'react';

import { patchRegistry, type Source } from '@/lib';
import { type SourceAction, writeFailure, writeSummary } from '@/lib/desk';

export type WriteOrigin = 'row' | 'pane' | 'bulk';

interface Write {
  origin: WriteOrigin;
  action: SourceAction;
  names: readonly string[];
}

export interface SourceActionsState {
  writable: boolean;
  pending: ReadonlySet<string>;
  copied: string | null;
  resubscribed: ReadonlySet<string>;
  isRunning: (
    origin: WriteOrigin,
    action: SourceAction,
    name?: string,
  ) => boolean;
  run: (
    names: readonly string[],
    action: SourceAction,
    origin: WriteOrigin,
    onSuccess?: () => void,
  ) => Promise<void>;
  resubscribe: (name: string, url: string) => void;
}

const COPIED_MS = 3000;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function useSourceActions({
  writable,
  registryFile,
  onSourcesChange,
  onReadOnly,
}: {
  writable: boolean;
  registryFile: string;
  onSourcesChange: (update: (prev: Source[]) => Source[]) => void;
  onReadOnly: () => void;
}): SourceActionsState {
  const [writes, setWrites] = useState<readonly Write[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [resubscribed, setResubscribed] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const inFlight = useRef(new Set<string>());

  const pending = new Set(writes.flatMap((w) => w.names));

  function isRunning(origin: WriteOrigin, action: SourceAction, name?: string) {
    return writes.some(
      (w) =>
        w.origin === origin &&
        w.action === action &&
        (name === undefined || w.names.includes(name)),
    );
  }

  async function run(
    names: readonly string[],
    action: SourceAction,
    origin: WriteOrigin,
    onSuccess?: () => void,
  ) {
    if (!writable || names.length === 0) return;
    if (names.some((name) => inFlight.current.has(name))) return;

    const write: Write = { origin, action, names };
    for (const name of names) inFlight.current.add(name);
    setWrites((prev) => [...prev, write]);
    try {
      const result = await patchRegistry<Source>(
        '/api/sources',
        [...names],
        action,
      );
      if (!result.ok) {
        if (result.readOnly) onReadOnly();
        else
          toast.error(writeFailure(action, names), {
            description: result.error,
          });
        return;
      }
      onSourcesChange(() => result.items);
      if (!result.writable) onReadOnly();
      onSuccess?.();
      toast.success(writeSummary(action, result.applied), {
        description: `Written to ${registryFile}`,
      });
    } catch (error) {
      toast.error(writeFailure(action, names), {
        description: messageOf(error),
      });
    } finally {
      for (const name of names) inFlight.current.delete(name);
      setWrites((prev) => prev.filter((w) => w !== write));
    }
  }

  function resubscribe(name: string, url: string) {
    setResubscribed((prev) => new Set(prev).add(name));
    const failed = () =>
      toast.error("Couldn't copy the feed URL", {
        description: `Paste it into Readwise by hand: ${url}`,
      });
    try {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(name);
        window.setTimeout(
          () => setCopied((current) => (current === name ? null : current)),
          COPIED_MS,
        );
      }, failed);
    } catch {
      failed();
    }
  }

  return {
    writable,
    pending,
    copied,
    resubscribed,
    isRunning,
    run,
    resubscribe,
  };
}
