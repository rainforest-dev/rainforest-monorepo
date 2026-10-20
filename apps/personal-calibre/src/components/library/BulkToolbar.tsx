'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Button,
  ButtonGroup,
  Kbd,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  toast,
} from '@rainforest-dev/rainforest-react';
import { Download, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { BASE_PATH, platformName } from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';
import { useLibrary } from '@/providers';
import type { DeliveryPlatform } from '@/types';

const ZIP_FORMATS = ['EPUB', 'PDF', 'MOBI', 'AZW3'];

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    return ((await res.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export function BulkToolbar({
  platforms,
  matchingIds,
}: {
  platforms: DeliveryPlatform[];
  matchingIds: number[];
}) {
  const router = useRouter();
  const t = useLibraryT(CALIBRE_NAMESPACE);
  const {
    selected,
    clear,
    addMany,
    bulkPlatform,
    setBulkPlatform,
    zipFormat,
    setZipFormat,
    setSelectMode,
    focusAfterToolbar,
  } = useLibrary();
  const [pending, setPending] = useState<'deliver' | 'zip' | null>(null);
  const busy = pending !== null;
  const toolbarRef = useRef<HTMLDivElement>(null);
  const platformKey = bulkPlatform || platforms[0]?.key || '';
  const count = selected.size;
  const everyMatchSelected =
    matchingIds.length > 0 && matchingIds.every((id) => selected.has(id));

  async function markDelivered() {
    if (!platformKey) return;
    setPending('deliver');
    try {
      const res = await fetch(`${BASE_PATH}/api/books/deliveries/bulk`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookIds: [...selected], platformKey }),
      });
      if (!res.ok)
        throw new Error(await readError(res, t('bulk.deliverFailed')));
      toast.success(
        t('bulk.delivered', {
          count,
          platform: platformName(platforms, platformKey),
        }),
      );
      clear();
      setSelectMode(false);
      const active = document.activeElement;
      if (
        active === null ||
        active === document.body ||
        toolbarRef.current?.contains(active)
      ) {
        focusAfterToolbar();
      }
      router.refresh();
    } catch (error) {
      toast.error(
        t('bulk.deliveryError', {
          message: messageOf(error, t('errors.unexpected')),
        }),
      );
    } finally {
      setPending(null);
    }
  }

  async function downloadZip() {
    setPending('zip');
    try {
      const res = await fetch(`${BASE_PATH}/api/books/download/bulk`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookIds: [...selected], format: zipFormat }),
      });
      if (!res.ok) throw new Error(await readError(res, t('bulk.zipFailed')));
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'books.zip';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        t('bulk.downloadError', {
          message: messageOf(error, t('errors.unexpected')),
        }),
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={t('bulk.label')}
      className="bg-card fixed inset-x-2 bottom-2 z-40 flex flex-wrap items-center gap-2 rounded-xl border p-2 shadow-lg lg:static lg:z-auto lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('bulk.clear')}
        disabled={busy}
        onClick={() => {
          clear();
          focusAfterToolbar();
        }}
      >
        <X aria-hidden />
      </Button>
      <span className="text-sm font-medium tabular-nums">
        {t('bulk.selected', { count })}
      </span>
      {!everyMatchSelected && (
        <Button
          variant="link"
          size="xs"
          disabled={busy}
          onClick={() => addMany(matchingIds)}
        >
          {t('bulk.selectAll', { count: matchingIds.length })}
        </Button>
      )}
      <ButtonGroup className="lg:ml-auto" aria-label={t('bulk.deliverTo')}>
        <Select
          items={platforms.map((p) => ({ value: p.key, label: p.name }))}
          value={platformKey}
          onValueChange={(value) => {
            if (typeof value === 'string') setBulkPlatform(value);
          }}
        >
          <SelectTrigger size="sm" aria-label={t('bulk.addTo')}>
            <span className="text-muted-foreground text-xs">
              {t('bulk.addTo')}
            </span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {platforms.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={busy || !platformKey}
          onClick={() => void markDelivered()}
        >
          {pending === 'deliver' && <Spinner data-icon="inline-start" />}
          {t('bulk.markDelivered')}
        </Button>
      </ButtonGroup>
      <ButtonGroup aria-label={t('bulk.format')}>
        <Select
          items={ZIP_FORMATS.map((f) => ({ value: f, label: f }))}
          value={zipFormat}
          onValueChange={(value) => {
            if (typeof value === 'string') setZipFormat(value);
          }}
        >
          <SelectTrigger size="sm" aria-label={t('bulk.format')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ZIP_FORMATS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void downloadZip()}
        >
          {pending === 'zip' ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Download aria-hidden />
          )}
          ZIP
        </Button>
      </ButtonGroup>
      <span className="text-muted-foreground hidden items-center gap-1 text-xs lg:inline-flex">
        <Kbd>Esc</Kbd> {t('bulk.clearHint')}
      </span>
    </div>
  );
}
