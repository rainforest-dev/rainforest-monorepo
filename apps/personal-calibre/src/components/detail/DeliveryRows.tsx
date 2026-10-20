'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Badge,
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  Spinner,
  toast,
} from '@rainforest-dev/rainforest-react';
import { Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Fragment, useId, useState } from 'react';

import {
  BASE_PATH,
  formatDeliveryDate,
  formatDeliveryTime,
  latestByPlatform,
  safeExternalHref,
} from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';
import type { BookDeliveryEvent, DeliveryPlatform } from '@/types';

interface Props {
  bookId: number;
  platforms: DeliveryPlatform[];
  events: BookDeliveryEvent[];
  headingAs: 'h2' | 'h3';
}

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

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
  const t = useLibraryT(CALIBRE_NAMESPACE);
  const latest = latestByPlatform(events);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <Heading
        id={headingId}
        className="text-muted-foreground text-xs font-medium uppercase tracking-wide"
      >
        {t('deliveries.title')}
      </Heading>
      <ItemGroup className="gap-0 rounded-lg border">
        {platforms.map((platform) => (
          <Fragment key={platform.key}>
            <ItemSeparator />
            <DeliveryRow
              bookId={bookId}
              platform={platform}
              latest={latest.get(platform.key) ?? null}
            />
          </Fragment>
        ))}
      </ItemGroup>
      {events.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer select-none">
            {t('deliveries.history', { count: events.length })}
          </summary>
          <ItemGroup className="mt-2 gap-2">
            {events.map((event) => (
              <HistoryItem key={event.id} bookId={bookId} event={event} />
            ))}
          </ItemGroup>
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
  const t = useLibraryT(CALIBRE_NAMESPACE);
  const [open, setOpen] = useState(false);
  const [externalRef, setExternalRef] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);

  async function save() {
    const trimmedRef = externalRef.trim();
    if (trimmedRef && !safeExternalHref(trimmedRef)) {
      setRefError(t('deliveries.badRef'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/books/${bookId}/deliveries`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platformKey: platform.key, note, externalRef }),
      });
      if (!res.ok)
        throw new Error(await readError(res, t('deliveries.addFailed')));
      toast.success(t('deliveries.logged', { name: platform.name }));
      setOpen(false);
      setNote('');
      setExternalRef('');
      setRefError(null);
      router.refresh();
    } catch (error) {
      toast.error(
        t('deliveries.failed', {
          message: messageOf(error, t('errors.unexpected')),
        }),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Item
      role="listitem"
      data-platform={platform.key}
      className="rounded-none py-2"
    >
      <ItemContent>
        <ItemTitle>
          {platform.name}
          {latest ? (
            <Badge variant="success">
              <Check aria-hidden />
              {formatDeliveryDate(latest.addedAt)}
            </Badge>
          ) : (
            <Badge variant="muted">{t('deliveries.notAdded')}</Badge>
          )}
        </ItemTitle>
      </ItemContent>
      <ItemActions>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<Button variant="outline" size="xs" />}>
            {latest ? t('deliveries.logAgain') : t('deliveries.markAdded')}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <PopoverHeader>
              <PopoverTitle>
                {t('deliveries.markTitle', { name: platform.name })}
              </PopoverTitle>
              <PopoverDescription>
                {t('deliveries.markHint')}
              </PopoverDescription>
            </PopoverHeader>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <FieldGroup className="gap-3">
                <Field data-invalid={refError ? true : undefined}>
                  <FieldLabel htmlFor={`${fieldId}-ref`}>
                    {t('deliveries.ref')}
                  </FieldLabel>
                  <Input
                    id={`${fieldId}-ref`}
                    name="externalRef"
                    type="url"
                    value={externalRef}
                    aria-invalid={refError ? true : undefined}
                    aria-describedby={
                      refError ? `${fieldId}-ref-error` : undefined
                    }
                    onChange={(e) => {
                      setExternalRef(e.target.value);
                      if (refError) setRefError(null);
                    }}
                  />
                  {refError && (
                    <FieldError id={`${fieldId}-ref-error`}>
                      {refError}
                    </FieldError>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${fieldId}-note`}>
                    {t('deliveries.note')}
                  </FieldLabel>
                  <Input
                    id={`${fieldId}-note`}
                    name="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
              </FieldGroup>
              <Button type="submit" size="sm" disabled={saving}>
                {saving && <Spinner data-icon="inline-start" />}
                {t('deliveries.save')}
              </Button>
            </form>
          </PopoverContent>
        </Popover>
      </ItemActions>
    </Item>
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
  const t = useLibraryT(CALIBRE_NAMESPACE);
  const [busy, setBusy] = useState(false);
  const externalHref = safeExternalHref(event.externalRef);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(
        `${BASE_PATH}/api/books/${bookId}/deliveries?deliveryId=${event.id}`,
        {
          method: 'DELETE',
        },
      );
      if (!res.ok)
        throw new Error(await readError(res, t('deliveries.deleteFailed')));
      router.refresh();
    } catch (error) {
      toast.error(
        t('deliveries.failed', {
          message: messageOf(error, t('errors.unexpected')),
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Item role="listitem" variant="outline" className="items-start px-2.5 py-2">
      <ItemContent className="min-w-0">
        <ItemTitle>
          {event.platformName}
          <span className="text-muted-foreground font-mono text-xs font-normal">
            {formatDeliveryTime(event.addedAt)}
          </span>
        </ItemTitle>
        {event.note && <ItemDescription>{event.note}</ItemDescription>}
        {event.externalRef && (
          <ItemDescription className="truncate">
            {externalHref ? (
              <a href={externalHref} target="_blank" rel="noreferrer noopener">
                {event.externalRef}
              </a>
            ) : (
              event.externalRef
            )}
          </ItemDescription>
        )}
      </ItemContent>
      <ItemActions>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t('deliveries.remove', { name: event.platformName })}
          disabled={busy}
          onClick={() => void remove()}
        >
          {busy ? <Spinner /> : <X aria-hidden />}
        </Button>
      </ItemActions>
    </Item>
  );
}
