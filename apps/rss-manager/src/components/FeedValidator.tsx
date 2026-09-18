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
          className="border-input bg-card text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30 flex-1 rounded border px-4 py-2 text-sm focus:outline-none focus:ring-2"
        />
        <button
          onClick={validate}
          disabled={!url || loading}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Validate'}
        </button>
      </div>

      {result && (
        <div
          className={`rounded-lg p-4 ${result.valid ? 'border-success/40 bg-success/10 border' : 'border-destructive/40 bg-destructive/10 border'}`}
        >
          {result.valid ? (
            <div className="space-y-1 text-sm">
              <p className="text-success font-medium">
                ✓ Valid {result.format?.toUpperCase()} feed
              </p>
              {result.title && (
                <p className="text-foreground">Title: {result.title}</p>
              )}
              {result.itemCount !== undefined && (
                <p className="text-muted-foreground">
                  {result.itemCount} item{result.itemCount !== 1 ? 's' : ''}{' '}
                  found
                </p>
              )}
            </div>
          ) : (
            <p className="text-destructive text-sm">✗ {result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
