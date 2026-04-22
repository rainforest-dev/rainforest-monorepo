'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BookDeliveryEvent, DeliveryPlatform } from '@/types/delivery';

interface DeliveryTrackerProps {
  bookId: number;
  platforms: DeliveryPlatform[];
  events: BookDeliveryEvent[];
}

export function DeliveryTracker({
  bookId,
  platforms,
  events,
}: DeliveryTrackerProps) {
  const router = useRouter();
  const [selectedPlatformKey, setSelectedPlatformKey] = useState(
    platforms[0]?.key ?? '',
  );
  const [note, setNote] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasPlatforms = platforms.length > 0;
  const canSubmit = hasPlatforms && selectedPlatformKey && !isSubmitting;

  const recentSummary = useMemo(() => {
    if (events.length === 0) return null;
    const latest = events[0];
    return `Last added to ${latest.platformName} on ${formatTimestamp(latest.addedAt)}`;
  }, [events]);

  async function addEvent() {
    if (!canSubmit) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/books/${bookId}/deliveries`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          platformKey: selectedPlatformKey,
          note,
          externalRef,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to add delivery event');
      }

      setNote('');
      setExternalRef('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function removeEvent(deliveryId: number) {
    setError(null);

    const response = await fetch(
      `/api/books/${bookId}/deliveries?deliveryId=${deliveryId}`,
      { method: 'DELETE' },
    );

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? 'Failed to delete delivery event');
      return;
    }

    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <h2 className="text-sm font-semibold">Delivery tracking</h2>
        <p className="text-muted-foreground text-xs">
          Track when this book was added to external platforms.
        </p>
        {recentSummary && (
          <p className="mt-1 text-xs">{recentSummary}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          aria-label="Delivery platform"
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          value={selectedPlatformKey}
          onChange={(event) => setSelectedPlatformKey(event.target.value)}
          disabled={!hasPlatforms || isSubmitting}
        >
          {platforms.map((platform) => (
            <option key={platform.id} value={platform.key}>
              {platform.name}
            </option>
          ))}
        </select>
        <Input
          placeholder="Reference URL (optional)"
          value={externalRef}
          onChange={(event) => setExternalRef(event.target.value)}
        />
      </div>

      <Input
        placeholder="Note (optional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={addEvent} disabled={!canSubmit}>
          {isSubmitting ? 'Saving...' : 'Mark as added'}
        </Button>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>

      <ul className="space-y-2">
        {events.length === 0 && (
          <li className="text-muted-foreground text-xs">No delivery events yet.</li>
        )}
        {events.map((event) => (
          <li
            key={event.id}
            className="flex flex-col gap-1 rounded-md border border-border/60 p-2 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span>
                Added to <strong>{event.platformName}</strong> on{' '}
                {formatTimestamp(event.addedAt)}
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground underline"
                onClick={() => removeEvent(event.id)}
              >
                Remove
              </button>
            </div>
            {event.externalRef && (
              <a
                href={event.externalRef}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground truncate underline"
              >
                {event.externalRef}
              </a>
            )}
            {event.note && <p className="text-muted-foreground">{event.note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}
