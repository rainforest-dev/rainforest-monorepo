import {
  Alert,
  AlertTitle,
  Badge,
  type BadgeProps,
  Button,
} from '@rainforest-dev/rainforest-react';
import { useEffect, useState } from 'react';

import { patchRegistry } from '../lib/patchRegistry.js';
import type { Topic } from '../lib/registry.types.js';
import { READ_ONLY_NOTE } from '../lib/registry.types.js';

const STATUS_VARIANT: Record<Topic['status'], BadgeProps['variant']> = {
  active: 'success',
  proposed: 'info',
  declined: 'muted',
};

function daysAgo(dateStr: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 86_400_000,
  );
  if (diff === 0) return 'today';
  if (diff === 1) return '1d ago';
  return `${diff}d ago`;
}

export default function TopicList() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [writable, setWritable] = useState(true);
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/topics')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { topics: Topic[]; writable: boolean }) => {
        setTopics(data.topics);
        setWritable(data.writable);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load topics.');
        setLoading(false);
      });
  }, []);

  async function doAction(name: string, action: 'activate' | 'decline') {
    setPending((p) => new Set(p).add(name));
    setActionError(null);
    try {
      const result = await patchRegistry('/api/topics', name, action);
      if (!result.ok) {
        // The banner above already states the read-only case; repeating it here
        // would read as a second, separate problem.
        if (result.readOnly) setWritable(false);
        else setActionError(result.error);
        return;
      }
      setTopics((prev) =>
        prev.map((t) => {
          if (t.name !== name) return t;
          if (action === 'activate') return { ...t, status: 'active' as const };
          if (action === 'decline')
            return { ...t, status: 'declined' as const };
          return t;
        }),
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(name);
        return n;
      });
    }
  }

  if (error)
    return <p className="text-destructive py-8 text-center">{error}</p>;
  if (loading)
    return (
      <p className="text-muted-foreground py-8 text-center">Loading topics…</p>
    );

  const byStatus = (status: Topic['status']) =>
    topics.filter((t) => t.status === status);

  return (
    <div className="space-y-6">
      {!writable && (
        <Alert variant="warning">
          <AlertTitle>
            {READ_ONLY_NOTE} Activate and Decline are disabled.
          </AlertTitle>
        </Alert>
      )}
      {actionError && (
        <Alert variant="destructive">
          <AlertTitle>{actionError}</AlertTitle>
        </Alert>
      )}

      {(['active', 'proposed', 'declined'] as const).map((status) => {
        const group = byStatus(status);
        if (group.length === 0) return null;
        return (
          <div key={status}>
            <h3 className="text-muted-foreground mb-3 text-sm font-semibold uppercase tracking-wider">
              {status} ({group.length})
            </h3>
            <div className="space-y-2">
              {group.map((t) => (
                <div
                  key={t.name}
                  className="bg-muted/50 flex items-start gap-3 rounded-lg p-3"
                >
                  <Badge variant={STATUS_VARIANT[status]} className="mt-0.5">
                    {status}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-foreground font-medium">{t.name}</p>
                    {t.description && (
                      <p className="text-muted-foreground text-sm">
                        {t.description}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {t.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-muted-foreground text-xs"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  {status === 'proposed' && (
                    <div className="flex shrink-0 items-center gap-2">
                      {t.proposedDate && (
                        <span className="text-muted-foreground text-xs">
                          {daysAgo(t.proposedDate)}
                        </span>
                      )}
                      <Button
                        size="xs"
                        onClick={() => doAction(t.name, 'activate')}
                        disabled={pending.has(t.name) || !writable}
                        title={writable ? undefined : READ_ONLY_NOTE}
                      >
                        {pending.has(t.name) ? '…' : 'Activate'}
                      </Button>
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => doAction(t.name, 'decline')}
                        disabled={pending.has(t.name) || !writable}
                        title={writable ? undefined : READ_ONLY_NOTE}
                      >
                        {pending.has(t.name) ? '…' : 'Decline'}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
