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
      if (!res.ok) {
        setResult({ valid: false, error: `Server error: ${res.status}` });
        return;
      }
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex gap-2">
        <input
          type="url"
          aria-label="Feed URL to validate"
          placeholder="https://example.com/rss.xml"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && validate()}
          className="flex-1 rounded border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-violet-500 focus:outline-none"
        />
        <button
          onClick={validate}
          disabled={!url || loading}
          className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Validate'}
        </button>
      </div>

      {result && (
        <div
          className={`rounded-lg p-4 ${result.valid ? 'border border-green-800 bg-green-900/30' : 'border border-red-800 bg-red-900/30'}`}
        >
          {result.valid ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium text-green-300">
                ✓ Valid {result.format?.toUpperCase()} feed
              </p>
              {result.title && (
                <p className="text-gray-300">Title: {result.title}</p>
              )}
              {result.itemCount !== undefined && (
                <p className="text-gray-400">
                  {result.itemCount} item{result.itemCount !== 1 ? 's' : ''}{' '}
                  found
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-red-300">✗ {result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
