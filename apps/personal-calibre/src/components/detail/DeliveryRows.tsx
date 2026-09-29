'use client';

import {
  Badge,
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  toast,
} from '@rainforest-dev/rainforest-react';
import { Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import {
  formatDeliveryDate,
  formatDeliveryTime,
  latestByPlatform,
} from '@/lib/deliveries';
import type { BookDeliveryEvent, DeliveryPlatform } from '@/types/delivery';

interface Props {
  bookId: number;
  platforms: DeliveryPlatform[];
  events: BookDeliveryEvent[];
  headingAs: 'h2' | 'h3';
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected error';

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    return ((await res.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export function DeliveryRows({
  bookId,
  platforms,
  events,
  headingAs: Heading,
}: Props) {
  const headingId = useId();
  const latest = latestByPlatform(events);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <Heading
        id={headingId}
        className="text-muted-foreground text-xs font-medium uppercase tracking-wide"
      >
        Deliveries
      </Heading>
      <ul className="divide-y rounded-lg border">
        {platforms.map((platform) => (
          <DeliveryRow
            key={platform.key}
            bookId={bookId}
            platform={platform}
            latest={latest.get(platform.key) ?? null}
          />
        ))}
      </ul>
      {events.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer select-none">
            History ({events.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {events.map((event) => (
              <HistoryItem key={event.id} bookId={bookId} event={event} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function DeliveryRow({
  bookId,
  platform,
  latest,
}: {
  bookId: number;
  platform: DeliveryPlatform;
  latest: BookDeliveryEvent | null;
}) {
  const router = useRouter();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [externalRef, setExternalRef] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/books/${bookId}/deliveries`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platformKey: platform.key, note, externalRef }),
      });
      if (!res.ok)
        throw new Error(await readError(res, 'Failed to add delivery event'));
      toast.success(`Logged ${platform.name}`);
      setOpen(false);
      setNote('');
      setExternalRef('');
      router.refresh();
    } catch (error) {
      toast.error(`Delivery failed — ${messageOf(error)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li
      data-platform={platform.key}
      className="flex items-center gap-3 px-3 py-2 text-sm"
    >
      <span className="font-medium">{platform.name}</span>
      {latest ? (
        <Badge variant="success">
          <Check aria-hidden />
          {formatDeliveryDate(latest.addedAt)}
        </Badge>
      ) : (
        <Badge variant="muted">Not added</Badge>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button variant="outline" size="xs" className="ml-auto" />}
        >
          {latest ? 'Log again' : 'Mark added'}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <PopoverHeader>
            <PopoverTitle>Mark as added to {platform.name}</PopoverTitle>
            <PopoverDescription>
              Logs today&apos;s date. Both fields are optional.
            </PopoverDescription>
          </PopoverHeader>
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label htmlFor={`${fieldId}-ref`} className="text-xs font-medium">
              Reference URL
            </label>
            <Input
              id={`${fieldId}-ref`}
              name="externalRef"
              inputMode="url"
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
            />
            <label htmlFor={`${fieldId}-note`} className="text-xs font-medium">
              Note
            </label>
            <Input
              id={`${fieldId}-note`}
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={saving}>
              Save
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </li>
  );
}

function HistoryItem({
  bookId,
  event,
}: {
  bookId: number;
  event: BookDeliveryEvent;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/books/${bookId}/deliveries?deliveryId=${event.id}`,
        {
          method: 'DELETE',
        },
      );
      if (!res.ok)
        throw new Error(
          await readError(res, 'Failed to delete delivery event'),
        );
      router.refresh();
    } catch (error) {
      toast.error(`Delivery failed — ${messageOf(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-start gap-2 rounded-md border p-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p>
          <span className="font-medium">{event.platformName}</span>{' '}
          <span className="text-muted-foreground font-mono text-xs">
            {formatDeliveryTime(event.addedAt)}
          </span>
        </p>
        {event.note && <p className="text-muted-foreground">{event.note}</p>}
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
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Remove ${event.platformName} event`}
        disabled={busy}
        onClick={() => void remove()}
      >
        <X aria-hidden />
      </Button>
    </li>
  );
}
