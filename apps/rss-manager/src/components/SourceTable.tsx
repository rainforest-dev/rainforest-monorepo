import {
  Alert,
  AlertTitle,
  Badge,
  type BadgeProps,
  Button,
  buttonVariants,
  cn,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@rainforest-dev/rainforest-react';
import { useEffect, useState } from 'react';

import { patchRegistry } from '../lib/patchRegistry.js';
import type { Source, StaleType } from '../lib/registry.types.js';
import { READ_ONLY_NOTE } from '../lib/registry.types.js';

/** Where Readwise manages feed subscriptions — the fix for a delivery gap. */
const READER_FEEDS_URL = 'https://read.readwise.io/feed/subscriptions';

const STALE_UI: Record<
  StaleType,
  { label: string; variant: BadgeProps['variant']; retirable: boolean }
> = {
  'feed-dead': {
    label: 'feed dead',
    variant: 'destructive',
    retirable: true,
  },
  'delivery-gap': {
    label: 'delivery gap',
    variant: 'warning',
    retirable: false,
  },
  'low-value': {
    label: 'low value',
    variant: 'warning',
    retirable: true,
  },
  unspecified: {
    label: 'flagged',
    variant: 'muted',
    retirable: true,
  },
};

function daysAgo(dateStr: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 86_400_000,
  );
  if (diff === 0) return 'today';
  if (diff === 1) return '1d ago';
  return `${diff}d ago`;
}

const STATUS_VARIANT: Record<Source['status'], BadgeProps['variant']> = {
  active: 'success',
  proposed: 'info',
  'no-rss': 'muted',
  retired: 'destructive',
};

export default function SourceTable() {
  const [sources, setSources] = useState<Source[]>([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [writable, setWritable] = useState(true);
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/sources')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { sources: Source[]; writable: boolean }) => {
        setSources(data.sources);
        setWritable(data.writable);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load sources.');
        setLoading(false);
      });
  }, []);

  async function doAction(name: string, action: 'activate' | 'retire') {
    setPending((p) => new Set(p).add(name));
    setActionError(null);
    try {
      const result = await patchRegistry('/api/sources', name, action);
      if (!result.ok) {
        // The banner above already states the read-only case; repeating it
        // under the table would read as a second, separate problem.
        if (result.readOnly) setWritable(false);
        else setActionError(result.error);
        return;
      }
      // Optimistic update
      setSources((prev) =>
        prev.map((s) => {
          if (s.name !== name) return s;
          if (action === 'activate') return { ...s, status: 'active' as const };
          if (action === 'retire') return { ...s, status: 'retired' as const };
          return s;
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

  /**
   * Readwise has no URL that adds a given feed, so re-subscribing means pasting
   * it into the Add feeds box (Shift + A). The click carries the URL over on
   * the clipboard and lets the link open the subscriptions page as usual.
   */
  async function copyFeedUrl(name: string, url: string) {
    if (!url) return;
    setActionError(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(name);
      window.setTimeout(
        () => setCopied((current) => (current === name ? null : current)),
        3000,
      );
    } catch {
      // Denied, or no clipboard outside a secure context. The page still opens,
      // so show the URL to copy by hand.
      setActionError(`Could not copy the feed URL — paste it by hand: ${url}`);
    }
  }

  const filtered = sources.filter((s) => {
    const matchesText =
      !filter ||
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      s.tags.some((t) => t.includes(filter.toLowerCase())) ||
      s.category.toLowerCase().includes(filter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesText && matchesStatus;
  });

  const counts = sources.reduce(
    (acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  if (error)
    return <p className="text-destructive py-8 text-center">{error}</p>;
  if (loading)
    return (
      <p className="text-muted-foreground py-8 text-center">Loading sources…</p>
    );

  return (
    <div className="space-y-4">
      {!writable && (
        <Alert variant="warning">
          <AlertTitle>
            {READ_ONLY_NOTE} Activate and Retire are disabled.
          </AlertTitle>
        </Alert>
      )}
      {actionError && (
        <Alert variant="destructive">
          <AlertTitle>{actionError}</AlertTitle>
        </Alert>
      )}

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'active', 'proposed', 'no-rss'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? 'default' : 'secondary'}
            aria-pressed={statusFilter === s}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all'
              ? `All (${sources.length})`
              : `${s} (${counts[s] ?? 0})`}
          </Button>
        ))}
      </div>

      {/* Search */}
      <Input
        type="search"
        aria-label="Filter sources"
        placeholder="Filter by name, tag, or category…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {/* Table */}
      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.url || s.name}>
                <TableCell>
                  {/* The name goes to the site; the feed XML is a click no
                      reader wants, so it gets its own small link instead. When
                      the feed URL does not say what the site is, the name is
                      plain text rather than a link onto XML. */}
                  <div className="flex items-center gap-2">
                    {s.siteUrl ? (
                      <a
                        href={s.siteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {s.name}
                      </a>
                    ) : (
                      <span className="text-foreground">{s.name}</span>
                    )}
                    {s.url && s.url !== s.siteUrl && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={s.url}
                        className="text-muted-foreground hover:text-foreground text-xs"
                      >
                        RSS
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {s.category || '—'}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className="flex flex-wrap gap-1">
                    {s.tags.map((t) => (
                      <Badge key={t} variant="muted">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge>
                    {s.stale && (
                      <Badge
                        title={s.stale.note}
                        variant={STALE_UI[s.stale.type].variant}
                      >
                        {STALE_UI[s.stale.type].label}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {s.proposedDate && s.status === 'proposed' && (
                      <span className="text-muted-foreground text-xs">
                        {daysAgo(s.proposedDate)}
                      </span>
                    )}
                    {s.status === 'proposed' && (
                      <Button
                        size="xs"
                        onClick={() => doAction(s.name, 'activate')}
                        disabled={pending.has(s.name) || !writable}
                        title={writable ? undefined : READ_ONLY_NOTE}
                      >
                        {pending.has(s.name) ? '…' : 'Activate'}
                      </Button>
                    )}
                    {s.status === 'active' &&
                      (s.stale && !STALE_UI[s.stale.type].retirable ? (
                        // The feed is alive; Readwise stopped delivering. Retiring
                        // here would destroy a working source to route around
                        // someone else's bug, so it is not offered at all.
                        <a
                          href={READER_FEEDS_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => copyFeedUrl(s.name, s.url)}
                          title={`Copies ${s.url} and opens Readwise — paste it there with Shift + A`}
                          className={cn(
                            buttonVariants({ size: 'xs' }),
                            'bg-warning text-warning-foreground hover:bg-warning/90',
                          )}
                        >
                          {copied === s.name ? 'Copied ✓' : 'Re-subscribe'}
                        </a>
                      ) : (
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => doAction(s.name, 'retire')}
                          disabled={pending.has(s.name) || !writable}
                          title={writable ? undefined : READ_ONLY_NOTE}
                        >
                          {pending.has(s.name) ? '…' : 'Retire'}
                        </Button>
                      ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <p className="text-muted-foreground py-8 text-center">
            No sources match the current filter.
          </p>
        )}
      </div>
    </div>
  );
}
