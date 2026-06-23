import { useState } from 'react';

type FeedResult = {
  valid: boolean;
  format?: string;
  title?: string;
  itemCount?: number;
  error?: string;
};

export default function FeedValidator() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<FeedResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function validate() {
    if (!url) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="https://example.com/rss.xml"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && validate()}
          className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500"
        />
        <button
          onClick={validate}
          disabled={!url || loading}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
        >
          {loading ? 'Checking…' : 'Validate'}
        </button>
      </div>

      {result && (
        <div className={`p-4 rounded-lg ${result.valid ? 'bg-green-900/30 border border-green-800' : 'bg-red-900/30 border border-red-800'}`}>
          {result.valid ? (
            <div className="space-y-1 text-sm">
              <p className="text-green-300 font-medium">✓ Valid {result.format?.toUpperCase()} feed</p>
              {result.title && <p className="text-gray-300">Title: {result.title}</p>}
              {result.itemCount !== undefined && (
                <p className="text-gray-400">{result.itemCount} item{result.itemCount !== 1 ? 's' : ''} found</p>
              )}
            </div>
          ) : (
            <p className="text-red-300 text-sm">✗ {result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
