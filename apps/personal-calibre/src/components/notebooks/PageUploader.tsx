'use client';

import { Button, Spinner, toast } from '@rainforest-dev/rainforest-react';
import { ImagePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, useRef, useState } from 'react';

import { readError } from './api';
import { decodeImage } from './crop-image';
import {
  type CropOutcome,
  type CropRequest,
  PageCropDialog,
} from './PageCropDialog';

export function PageUploader({ notebookId }: { notebookId: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [cropping, setCropping] = useState<CropRequest | null>(null);
  const settle = useRef<((outcome: CropOutcome) => void) | null>(null);

  /** Shows the crop step for one image and waits for the choice made there. */
  const askCrop = (request: CropRequest) =>
    new Promise<CropOutcome>((resolve) => {
      settle.current = resolve;
      setCropping(request);
    });

  function onCropResolved(outcome: CropOutcome) {
    const resolve = settle.current;
    settle.current = null;
    resolve?.(outcome);
  }

  /**
   * Each image the browser can decode goes through the crop step; the rest (HEIC outside
   * Safari, scanned PDFs) go up as they are, and the server converts or splits them. `null` when the user cancelled.
   */
  async function preparePages(files: File[]): Promise<File[] | null> {
    const pages: File[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const bitmap = await decodeImage(file);
        if (!bitmap) {
          pages.push(file);
          continue;
        }
        try {
          const outcome = await askCrop({
            file,
            bitmap,
            index,
            total: files.length,
          });
          if (outcome.kind === 'cancel') return null;
          pages.push(...(outcome.kind === 'pages' ? outcome.files : [file]));
        } finally {
          bitmap.close();
        }
      }
      return pages;
    } finally {
      setCropping(null);
    }
  }

  async function upload(pages: File[]) {
    const form = new FormData();
    for (const page of pages) form.append('file', page);
    const response = await fetch(`/api/notebooks/${notebookId}/pages`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      toast.error(await readError(response, 'Upload failed'));
      return;
    }
    const { added, skipped } = (await response.json()) as {
      added: number[];
      skipped: Array<{ name: string; reason: string }>;
    };
    if (added.length > 0) {
      toast.success(
        `Added ${added.length} page${added.length === 1 ? '' : 's'}`,
      );
    }
    if (skipped.length > 0) {
      toast.info(
        `Skipped ${skipped.length}: ${skipped.map((s) => s.name).join(', ')}`,
      );
    }
    router.refresh();
  }

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (files.length === 0) return;

    setBusy(true);
    try {
      const pages = await preparePages(files);
      if (pages && pages.length > 0) await upload(pages);
    } catch {
      toast.error('Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(event) => void onChange(event)}
      />
      <Button disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Spinner /> : <ImagePlus aria-hidden />}
        {!busy ? 'Add pages' : cropping ? 'Cropping…' : 'Uploading…'}
      </Button>
      <PageCropDialog request={cropping} onResolve={onCropResolved} />
    </>
  );
}
