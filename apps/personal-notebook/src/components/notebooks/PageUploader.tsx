'use client';

import { Button, Spinner, toast } from '@rainforest-dev/rainforest-react';
import { ImagePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, useRef, useState } from 'react';

import { withBase } from '@/lib';

import { readError } from './api';
import { useCropStep } from './use-crop-step';

export function PageUploader({ notebookId }: { notebookId: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { preparePages, cropping, dialog } = useCropStep();

  async function upload(pages: File[]) {
    const form = new FormData();
    for (const page of pages) form.append('file', page);
    const response = await fetch(
      withBase(`/api/notebooks/${notebookId}/pages`),
      {
        method: 'POST',
        body: form,
      },
    );
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
      {dialog}
    </>
  );
}
