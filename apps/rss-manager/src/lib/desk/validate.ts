export type FeedResult = {
  valid: boolean;
  format?: string;
  title?: string;
  itemCount?: number;
  error?: string;
};

export async function validateFeed(url: string): Promise<FeedResult> {
  const res = await fetch('/api/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const body = (await res.json().catch(() => null)) as FeedResult | null;
  if (res.ok && body) return body;
  return {
    valid: false,
    error: body?.error ?? `Server error: ${res.status}`,
  };
}
