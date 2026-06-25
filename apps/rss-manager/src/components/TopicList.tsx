import { useEffect, useState } from 'react';

type Topic = {
  name: string;
  tags: string[];
  description: string;
  status: 'active' | 'proposed' | 'declined';
  proposedDate?: string;
};

const STATUS_COLORS: Record<Topic['status'], string> = {
  active: 'bg-green-900 text-green-300',
  proposed: 'bg-blue-900 text-blue-300',
  declined: 'bg-gray-800 text-gray-500',
};

function daysAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (diff === 0) return 'today';
  if (diff === 1) return '1d ago';
  return `${diff}d ago`;
}

export default function TopicList() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/topics')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Topic[]) => { setTopics(data); setLoading(false); })
      .catch(() => { setError('Failed to load topics.'); setLoading(false); });
  }, []);

  async function doAction(name: string, action: 'activate' | 'decline') {
    setPending((p) => new Set(p).add(name));
    try {
      const res = await fetch('/api/topics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, action }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setTopics((prev) =>
        prev.map((t) => {
          if (t.name !== name) return t;
          if (action === 'activate') return { ...t, status: 'active' as const };
          if (action === 'decline') return { ...t, status: 'declined' as const };
          return t;
        }),
      );
    } catch (e) {
      alert(`Action failed: ${e}`);
    } finally {
      setPending((p) => { const n = new Set(p); n.delete(name); return n; });
    }
  }

  if (error) return <p className="text-red-400 py-8 text-center">{error}</p>;
  if (loading) return <p className="text-gray-400 py-8 text-center">Loading topics…</p>;

  const byStatus = (status: Topic['status']) => topics.filter((t) => t.status === status);

  return (
    <div className="space-y-6">
      {(['active', 'proposed', 'declined'] as const).map((status) => {
        const group = byStatus(status);
        if (group.length === 0) return null;
        return (
          <div key={status}>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {status} ({group.length})
            </h3>
            <div className="space-y-2">
              {group.map((t) => (
                <div key={t.name} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <span className={`mt-0.5 px-2 py-0.5 rounded text-xs shrink-0 ${STATUS_COLORS[status]}`}>
                    {status}
                  </span>
                  <div className="flex-1">
                    <p className="text-gray-200 font-medium">{t.name}</p>
                    {t.description && (
                      <p className="text-gray-400 text-sm">{t.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {t.tags.map((tag) => (
                        <span key={tag} className="text-xs text-gray-500">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  {status === 'proposed' && (
                    <div className="flex items-center gap-2 shrink-0">
                      {t.proposedDate && (
                        <span className="text-xs text-gray-500">{daysAgo(t.proposedDate)}</span>
                      )}
                      <button
                        onClick={() => doAction(t.name, 'activate')}
                        disabled={pending.has(t.name)}
                        className="px-3 py-1 text-xs rounded bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
                      >
                        {pending.has(t.name) ? '…' : 'Activate'}
                      </button>
                      <button
                        onClick={() => doAction(t.name, 'decline')}
                        disabled={pending.has(t.name)}
                        className="px-3 py-1 text-xs rounded bg-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-50 transition-colors"
                      >
                        {pending.has(t.name) ? '…' : 'Decline'}
                      </button>
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
