import { useEffect, useState } from 'react';

type Topic = {
  name: string;
  tags: string[];
  description: string;
  status: 'active' | 'proposed' | 'declined';
};

const STATUS_COLORS: Record<Topic['status'], string> = {
  active: 'bg-green-900 text-green-300',
  proposed: 'bg-blue-900 text-blue-300',
  declined: 'bg-gray-800 text-gray-500',
};

export default function TopicList() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/topics')
      .then((r) => r.json())
      .then((data) => { setTopics(data); setLoading(false); });
  }, []);

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
                  <div>
                    <p className="text-gray-200 font-medium">{t.name}</p>
                    {t.description && <p className="text-gray-400 text-sm">{t.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {t.tags.map((tag) => (
                        <span key={tag} className="text-xs text-gray-500">#{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
