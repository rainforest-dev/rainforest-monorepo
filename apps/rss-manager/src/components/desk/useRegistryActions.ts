import { toast } from '@rainforest-dev/rainforest-react';
import { useRef, useState } from 'react';

import { patchRegistry, type Source, type Topic } from '@/lib';
import {
  type RegistryAction,
  type RegistryKind,
  type SourceAction,
  type TopicAction,
  writeFailure,
  writeSummary,
} from '@/lib/desk';

export type WriteOrigin = 'row' | 'pane' | 'bulk';

interface Write<A> {
  origin: WriteOrigin;
  action: A;
  names: readonly string[];
}

export interface RegistryActionsState<A extends RegistryAction> {
  writable: boolean;
  pending: ReadonlySet<string>;
  isRunning: (origin: WriteOrigin, action: A, name?: string) => boolean;
  run: (
    names: readonly string[],
    action: A,
    origin: WriteOrigin,
    onSuccess?: () => void,
  ) => Promise<void>;
}

export interface SourceActionsState extends RegistryActionsState<SourceAction> {
  copied: string | null;
  resubscribed: ReadonlySet<string>;
  resubscribe: (name: string, url: string) => void;
}

export type TopicActionsState = RegistryActionsState<TopicAction>;

interface RegistryActionsOptions<T> {
  writable: boolean;
  registryFile: string;
  onItemsChange: (update: (prev: T[]) => T[]) => void;
  onReadOnly: () => void;
}

const COPIED_MS = 3000;

const ENDPOINT: Record<RegistryKind, string> = {
  sources: '/api/sources',
  topics: '/api/topics',
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function useRegistryActions<T, A extends RegistryAction>(
  kind: RegistryKind,
  {
    writable,
    registryFile,
    onItemsChange,
    onReadOnly,
  }: RegistryActionsOptions<T>,
): RegistryActionsState<A> {
  const [writes, setWrites] = useState<readonly Write<A>[]>([]);
  const inFlight = useRef(new Set<string>());

  const pending = new Set(writes.flatMap((w) => w.names));

  function isRunning(origin: WriteOrigin, action: A, name?: string) {
    return writes.some(
      (w) =>
        w.origin === origin &&
        w.action === action &&
        (name === undefined || w.names.includes(name)),
    );
  }

  async function run(
    names: readonly string[],
    action: A,
    origin: WriteOrigin,
    onSuccess?: () => void,
  ) {
    if (!writable || names.length === 0) return;
    if (names.some((name) => inFlight.current.has(name))) return;

    const write: Write<A> = { origin, action, names };
    for (const name of names) inFlight.current.add(name);
    setWrites((prev) => [...prev, write]);
    try {
      const result = await patchRegistry<T>(ENDPOINT[kind], [...names], action);
      if (!result.ok) {
        if (result.readOnly) onReadOnly();
        else
          toast.error(writeFailure(action, names, kind), {
            description: result.error,
          });
        return;
      }
      onItemsChange(() => result.items);
      if (!result.writable) onReadOnly();
      onSuccess?.();
      toast.success(writeSummary(action, result.applied, kind), {
        description: `Written to ${registryFile}`,
      });
    } catch (error) {
      toast.error(writeFailure(action, names, kind), {
        description: messageOf(error),
      });
    } finally {
      for (const name of names) inFlight.current.delete(name);
      setWrites((prev) => prev.filter((w) => w !== write));
    }
  }

  return { writable, pending, isRunning, run };
}

export function useTopicActions(
  options: RegistryActionsOptions<Topic>,
): TopicActionsState {
  return useRegistryActions<Topic, TopicAction>('topics', options);
}

export function useSourceActions(
  options: RegistryActionsOptions<Source>,
): SourceActionsState {
  const writes = useRegistryActions<Source, SourceAction>('sources', options);
  const [copied, setCopied] = useState<string | null>(null);
  const [resubscribed, setResubscribed] = useState<ReadonlySet<string>>(
    new Set(),
  );

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

  return { ...writes, copied, resubscribed, resubscribe };
}
