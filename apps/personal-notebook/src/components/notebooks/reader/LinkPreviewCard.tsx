'use client';

import { asLinkPreview, type LinkPreview } from '@rainforest-dev/journal-kit';
import { useEffect, useState } from 'react';

import { withBase } from '@/lib';

const previews = new Map<string, Promise<LinkPreview | undefined>>();

function loadPreview(href: string): Promise<LinkPreview | undefined> {
  let request = previews.get(href);
  if (!request) {
    request = fetch(
      withBase(`/api/link-preview?url=${encodeURIComponent(href)}`),
    )
      .then((response) => (response.ok ? response.json() : undefined))
      .then(asLinkPreview)
      .catch(() => undefined);
    previews.set(href, request);
  }
  return request;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** A card for a web link in a page's text, filled in once the page's metadata arrives. */
export function LinkPreviewCard({ href }: { href: string }) {
  const [preview, setPreview] = useState<LinkPreview>();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void loadPreview(href).then((next) => {
      if (live) setPreview(next);
    });
    return () => {
      live = false;
    };
  }, [href]);

  if (!preview?.title) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-muted/50 hover:bg-muted focus-visible:ring-ring flex items-stretch gap-3 overflow-hidden rounded-md border p-2.5 outline-none transition-colors focus-visible:ring-2 motion-reduce:transition-none"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-muted-foreground truncate text-xs">
          {preview.siteName ?? hostOf(href)}
        </span>
        <span className="line-clamp-2 break-words text-sm font-semibold">
          {preview.title}
        </span>
        {preview.description && (
          <span className="text-muted-foreground line-clamp-2 break-words text-xs">
            {preview.description}
          </span>
        )}
      </span>
      {preview.image && !imageFailed && (
        <img
          src={preview.image}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="bg-muted size-16 shrink-0 self-center rounded-sm object-cover"
        />
      )}
    </a>
  );
}
