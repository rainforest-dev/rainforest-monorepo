import { useEffect, useState } from 'react';

type Source = {
  name: string;
  url: string;
  tags: string[];
  status: 'active' | 'pending' | 'proposed' | 'no-rss' | 'retired';
  category: string;
};

const STATUS_COLORS: Record<Source['status'], string> = {
  active: 'bg-green-900 text-green-300',
  pending: 'bg-yellow-900 text-yellow-300',
  proposed: 'bg-blue-900 text-blue-300',
  'no-rss': 'bg-gray-800 text-gray-400',
  retired: 'bg-red-900 text-red-400',
};

export default function SourceTable() {
  const [sources, setSources] = useState<Source[]>([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sources')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Source[]) => { setSources(data); setLoading(false); })
      .catch(() => { setError('Failed to load sources.'); setLoading(false); });
  }, []);

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

  if (error) return <p className="text-red-400 py-8 text-center">{error}</p>;
  if (loading) return <p className="text-gray-400 py-8 text-center">Loading sources…</p>;

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'active', 'pending', 'proposed', 'no-rss'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-violet-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s === 'all' ? `All (${sources.length})` : `${s} (${counts[s] ?? 0})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Filter by name, tag, or category…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500"
      />

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-800">
              <th className="py-2 pr-4 font-medium">Source</th>
              <th className="py-2 pr-4 font-medium">Category</th>
              <th className="py-2 pr-4 font-medium">Tags</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.url || s.name} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="py-2 pr-4">
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 hover:underline"
                    >
                      {s.name}
                    </a>
                  ) : (
                    <span className="text-gray-300">{s.name}</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-gray-400">{s.category || '—'}</td>
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {s.tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-xs">
                        #{t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[s.status]}`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-gray-500 text-center py-8">No sources match the current filter.</p>
        )}
      </div>
    </div>
  );
}
