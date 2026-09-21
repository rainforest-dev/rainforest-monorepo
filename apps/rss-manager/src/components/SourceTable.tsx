import { useEffect, useState } from 'react';

// Re-declared locally rather than imported: registry.ts pulls in node:fs, which
// would land in the client bundle for this island.
type StaleType = 'feed-dead' | 'delivery-gap' | 'low-value' | 'unspecified';

type Source = {
  name: string;
  url: string;
  siteUrl: string;
  tags: string[];
  status: 'active' | 'proposed' | 'no-rss' | 'retired';
  category: string;
  proposedDate?: string;
  stale?: { type: StaleType; note: string };
};

/** Where Readwise manages feed subscriptions — the fix for a delivery gap. */
const READER_FEEDS_URL = 'https://read.readwise.io/feed/subscriptions';

const READ_ONLY_NOTE =
  'The vault is mounted read-only, so the registry cannot be edited from here.';

const STALE_UI: Record<
  StaleType,
  { label: string; className: string; retirable: boolean }
> = {
  'feed-dead': {
    label: 'feed dead',
    className: 'bg-destructive/15 text-destructive',
    retirable: true,
  },
  'delivery-gap': {
    label: 'delivery gap',
    className: 'bg-warning/15 text-warning',
    retirable: false,
  },
  'low-value': {
    label: 'low value',
    className: 'bg-warning/15 text-warning',
    retirable: true,
  },
  unspecified: {
    label: 'flagged',
    className: 'bg-muted text-muted-foreground',
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

const STATUS_COLORS: Record<Source['status'], string> = {
  active: 'bg-success/15 text-success',
  proposed: 'bg-info/15 text-info',
  'no-rss': 'bg-muted text-muted-foreground',
  retired: 'bg-destructive/15 text-destructive',
};

export default function SourceTable() {
  const [sources, setSources] = useState<Source[]>([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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
      const res = await fetch('/api/sources', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, action }),
      });
      // Success is read from the body, not the status: an auth proxy answers a
      // redirected PATCH with its own 200 page, which would otherwise look like
      // a write that landed.
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        writable?: boolean;
      } | null;
      if (!res.ok || !body?.ok) {
        if (body?.writable === false) setWritable(false);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
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
        <p className="bg-warning/15 text-warning rounded px-3 py-2 text-sm">
          {READ_ONLY_NOTE} Activate and Retire are disabled.
        </p>
      )}
      {actionError && (
        <p className="bg-destructive/15 text-destructive rounded px-3 py-2 text-sm">
          {actionError}
        </p>
      )}

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'active', 'proposed', 'no-rss'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {s === 'all'
              ? `All (${sources.length})`
              : `${s} (${counts[s] ?? 0})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Filter by name, tag, or category…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="border-input bg-card text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30 w-full rounded border px-4 py-2 text-sm focus:outline-none focus:ring-2"
      />

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left">
              <th className="py-2 pr-4 font-medium">Source</th>
              <th className="py-2 pr-4 font-medium">Category</th>
              <th className="py-2 pr-4 font-medium">Tags</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr
                key={s.url || s.name}
                className="border-border hover:bg-muted/50 border-b"
              >
                <td className="py-2 pr-4">
                  {/* The name goes to the site; the feed XML is a click no
                      reader wants, so it gets its own small link instead. */}
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
                </td>
                <td className="text-muted-foreground py-2 pr-4">
                  {s.category || '—'}
                </td>
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {s.tags.map((t) => (
                      <span
                        key={t}
                        className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap items-center gap-1">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[s.status]}`}
                    >
                      {s.status}
                    </span>
                    {s.stale && (
                      <span
                        title={s.stale.note}
                        className={`rounded px-2 py-0.5 text-xs ${STALE_UI[s.stale.type].className}`}
                      >
                        {STALE_UI[s.stale.type].label}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {s.proposedDate && s.status === 'proposed' && (
                      <span className="text-muted-foreground text-xs">
                        {daysAgo(s.proposedDate)}
                      </span>
                    )}
                    {s.status === 'proposed' && (
                      <button
                        onClick={() => doAction(s.name, 'activate')}
                        disabled={pending.has(s.name) || !writable}
                        title={writable ? undefined : READ_ONLY_NOTE}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-3 py-1 text-xs transition-colors disabled:opacity-50"
                      >
                        {pending.has(s.name) ? '…' : 'Activate'}
                      </button>
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
                          className="bg-warning text-warning-foreground hover:bg-warning/90 rounded px-3 py-1 text-xs transition-colors"
                        >
                          Re-subscribe
                        </a>
                      ) : (
                        <button
                          onClick={() => doAction(s.name, 'retire')}
                          disabled={pending.has(s.name) || !writable}
                          title={writable ? undefined : READ_ONLY_NOTE}
                          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded px-3 py-1 text-xs transition-colors disabled:opacity-50"
                        >
                          {pending.has(s.name) ? '…' : 'Retire'}
                        </button>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-muted-foreground py-8 text-center">
            No sources match the current filter.
          </p>
        )}
      </div>
    </div>
  );
}
