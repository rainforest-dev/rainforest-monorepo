import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
} from '@rainforest-dev/rainforest-react';
import { CircleCheckIcon, CircleXIcon } from 'lucide-react';
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
        <Input
          type="url"
          aria-label="Feed URL to validate"
          placeholder="https://example.com/rss.xml"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && validate()}
          className="flex-1"
        />
        <Button onClick={validate} disabled={!url || loading}>
          {loading ? 'Checking…' : 'Validate'}
        </Button>
      </div>

      {result &&
        (result.valid ? (
          <Alert variant="success">
            <CircleCheckIcon />
            <AlertTitle>Valid {result.format?.toUpperCase()} feed</AlertTitle>
            <AlertDescription>
              {result.title && <p>Title: {result.title}</p>}
              {result.itemCount !== undefined && (
                <p className="text-muted-foreground">
                  {result.itemCount} item{result.itemCount !== 1 ? 's' : ''}{' '}
                  found
                </p>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <CircleXIcon />
            <AlertTitle>{result.error}</AlertTitle>
          </Alert>
        ))}
    </div>
  );
}
