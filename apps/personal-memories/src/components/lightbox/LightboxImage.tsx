import { Skeleton } from '@rainforest-dev/rainforest-react';
import { ImageOffIcon } from 'lucide-react';
import { useState } from 'react';

import type { LightboxItem } from '../../lib/lightbox.ts';
import { thumbUrl } from '../../lib/stream.ts';

export function LightboxImage({ item }: { item: LightboxItem }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  if (item.video) {
    return (
      <video
        controls
        preload="metadata"
        src={`/media/${encodeURIComponent(item.id)}`}
        className="max-h-[70vh] w-full rounded-lg"
      />
    );
  }
  const ratio =
    item.width && item.height ? `${item.width} / ${item.height}` : '3 / 2';
  return (
    <div
      className="relative mx-auto max-h-[70vh] w-full"
      style={{ aspectRatio: ratio }}
    >
      {state === 'loading' && (
        <Skeleton className="absolute inset-0 rounded-lg" />
      )}
      {state === 'error' ? (
        <div
          role="img"
          aria-label="圖片載入失敗"
          className="bg-muted text-muted-foreground text-meta absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg"
        >
          <ImageOffIcon className="size-4" aria-hidden />
          圖片載入失敗
        </div>
      ) : (
        <img
          src={thumbUrl(item.id, 0, 960)}
          alt={item.alt}
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
          className="absolute inset-0 size-full rounded-lg object-contain"
        />
      )}
    </div>
  );
}
