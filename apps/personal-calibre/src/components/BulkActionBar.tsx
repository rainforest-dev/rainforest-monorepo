'use client';

import type { DeliveryPlatform } from '@/types/delivery';

interface Props {
  selectedCount: number;
  platforms: DeliveryPlatform[];
  selectedPlatformKey: string;
  onPlatformChange: (key: string) => void;
  onAddToPlatform: () => void;
  onDownloadZip: () => void;
  onClear: () => void;
  isSubmitting: boolean;
  zipFormat: string;
  onZipFormatChange: (fmt: string) => void;
  error: string | null;
}

export function BulkActionBar({
  selectedCount,
  platforms,
  selectedPlatformKey,
  onPlatformChange,
  onAddToPlatform,
  onDownloadZip,
  onClear,
  isSubmitting,
  zipFormat,
  onZipFormatChange,
  error,
}: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3 shadow-xl backdrop-blur">
      <span className="text-sm font-medium">{selectedCount} selected</span>

      <div className="flex items-center gap-2">
        <select
          aria-label="Platform"
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          value={selectedPlatformKey}
          onChange={(e) => onPlatformChange(e.target.value)}
          disabled={isSubmitting}
        >
          {platforms.map((p) => (
            <option key={p.id} value={p.key}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onAddToPlatform}
          disabled={isSubmitting || !selectedPlatformKey}
          className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        >
          {isSubmitting ? 'Adding…' : 'Add to platform'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <select
          aria-label="Download format"
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          value={zipFormat}
          onChange={(e) => onZipFormatChange(e.target.value)}
          disabled={isSubmitting}
        >
          {['EPUB', 'PDF', 'MOBI', 'AZW3'].map((fmt) => (
            <option key={fmt} value={fmt}>
              {fmt}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onDownloadZip}
          disabled={isSubmitting}
          className="hover:bg-accent rounded-lg border border-input px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          Download ZIP
        </button>
      </div>

      <button
        type="button"
        onClick={onClear}
        className="text-muted-foreground hover:text-foreground text-sm underline"
      >
        Clear
      </button>

      {error && <p className="text-destructive w-full text-xs">{error}</p>}
    </div>
  );
}
