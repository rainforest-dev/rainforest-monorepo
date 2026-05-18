'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import type { BookSummary } from '@/types/calibre';
import type { DeliveryPlatform } from '@/types/delivery';

import { BookGrid } from './BookGrid';
import { BulkActionBar } from './BulkActionBar';

interface Props {
  books: BookSummary[];
  from?: Record<string, string | undefined>;
  platforms: DeliveryPlatform[];
}

export function BulkSelectionWrapper({ books, from, platforms }: Props) {
  const router = useRouter();
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedPlatformKey, setSelectedPlatformKey] = useState(platforms[0]?.key ?? '');
  const [zipFormat, setZipFormat] = useState('EPUB');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clear() {
    setSelectedIds(new Set());
  }

  function exitSelectMode() {
    setIsSelectMode(false);
    clear();
  }

  async function handleAddToPlatform() {
    if (selectedIds.size === 0 || !selectedPlatformKey) return;
    setError(null);
    setIsSubmitting(true);
    const count = selectedIds.size;
    const platformName = platforms.find((p) => p.key === selectedPlatformKey)?.name ?? selectedPlatformKey;
    try {
      const res = await fetch('/api/books/deliveries/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bookIds: Array.from(selectedIds),
          platformKey: selectedPlatformKey,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to add deliveries');
      }
      exitSelectMode();
      toast.success(`${count} book${count !== 1 ? 's' : ''} marked as delivered to ${platformName}`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setError(msg);
      toast.error(`Delivery failed — ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDownloadZip() {
    if (selectedIds.size === 0) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/books/download/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bookIds: Array.from(selectedIds),
          format: zipFormat,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to build ZIP');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'books.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setError(msg);
      toast.error(`Download failed — ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => (isSelectMode ? exitSelectMode() : setIsSelectMode(true))}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            isSelectMode
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-input hover:bg-accent'
          }`}
        >
          {isSelectMode ? 'Cancel select' : 'Select'}
        </button>
        {isSelectMode && selectedIds.size > 0 && (
          <button
            type="button"
            onClick={() => setSelectedIds(new Set(books.map((b) => b.id)))}
            className="text-muted-foreground hover:text-foreground text-sm underline"
          >
            Select all ({books.length})
          </button>
        )}
      </div>

      <BookGrid
        books={books}
        from={isSelectMode ? undefined : from}
        selectedIds={isSelectMode ? selectedIds : undefined}
        onToggle={isSelectMode ? toggle : undefined}
      />

      <BulkActionBar
        selectedCount={selectedIds.size}
        platforms={platforms}
        selectedPlatformKey={selectedPlatformKey}
        onPlatformChange={setSelectedPlatformKey}
        onAddToPlatform={handleAddToPlatform}
        onDownloadZip={handleDownloadZip}
        onClear={clear}
        isSubmitting={isSubmitting}
        zipFormat={zipFormat}
        onZipFormatChange={setZipFormat}
        error={error}
      />
    </>
  );
}
