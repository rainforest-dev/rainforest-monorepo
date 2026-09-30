'use client';

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

import { platformName } from '@/lib/platforms';
import type { DeliveryPlatform } from '@/types/delivery';

import { useLibrary } from './LibraryProvider';

const ZIP_FORMATS = ['EPUB', 'PDF', 'MOBI', 'AZW3'];

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected error';

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
      const res = await fetch('/api/books/deliveries/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookIds: [...selected], platformKey }),
      });
      if (!res.ok)
        throw new Error(await readError(res, 'Failed to add deliveries'));
      toast.success(
        `${count} book${count === 1 ? '' : 's'} marked as delivered to ${platformName(platforms, platformKey)}`,
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
      toast.error(`Delivery failed — ${messageOf(error)}`);
    } finally {
      setPending(null);
    }
  }

  async function downloadZip() {
    setPending('zip');
    try {
      const res = await fetch('/api/books/download/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookIds: [...selected], format: zipFormat }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Failed to build ZIP'));
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'books.zip';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(`Download failed — ${messageOf(error)}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Bulk actions"
      className="bg-card fixed inset-x-2 bottom-2 z-40 flex flex-wrap items-center gap-2 rounded-xl border p-2 shadow-lg lg:static lg:z-auto lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Clear selection (Esc)"
        disabled={busy}
        onClick={() => {
          clear();
          focusAfterToolbar();
        }}
      >
        <X aria-hidden />
      </Button>
      <span className="text-sm font-medium tabular-nums">{count} selected</span>
      {!everyMatchSelected && (
        <Button
          variant="link"
          size="xs"
          disabled={busy}
          onClick={() => addMany(matchingIds)}
        >
          Select all {matchingIds.length}
        </Button>
      )}
      <ButtonGroup className="lg:ml-auto" aria-label="Deliver to platform">
        <Select
          items={platforms.map((p) => ({ value: p.key, label: p.name }))}
          value={platformKey}
          onValueChange={(value) => {
            if (typeof value === 'string') setBulkPlatform(value);
          }}
        >
          <SelectTrigger size="sm" aria-label="Add to">
            <span className="text-muted-foreground text-xs">Add to</span>
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
          Mark delivered
        </Button>
      </ButtonGroup>
      <ButtonGroup aria-label="Download format">
        <Select
          items={ZIP_FORMATS.map((f) => ({ value: f, label: f }))}
          value={zipFormat}
          onValueChange={(value) => {
            if (typeof value === 'string') setZipFormat(value);
          }}
        >
          <SelectTrigger size="sm" aria-label="Download format">
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
        <Kbd>Esc</Kbd> clear
      </span>
    </div>
  );
}
