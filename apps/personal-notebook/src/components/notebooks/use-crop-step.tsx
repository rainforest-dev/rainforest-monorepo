'use client';

import { useRef, useState } from 'react';

import { decodeImage } from './crop-image';
import {
  type CropOutcome,
  type CropRequest,
  PageCropDialog,
} from './PageCropDialog';

/**
 * The crop step shared by adding and replacing pages. `preparePages` shows the crop dialog for
 * each image the browser can decode and resolves to the files to upload; the rest (HEIC
 * outside Safari, scanned PDFs) go up as they are and the server converts or splits them. It
 * resolves to `null` when the user cancels. Render `dialog` once.
 */
export function useCropStep() {
  const [cropping, setCropping] = useState<CropRequest | null>(null);
  const settle = useRef<((outcome: CropOutcome) => void) | null>(null);

  const askCrop = (request: CropRequest) =>
    new Promise<CropOutcome>((resolve) => {
      settle.current = resolve;
      setCropping(request);
    });

  function onResolve(outcome: CropOutcome) {
    const resolve = settle.current;
    settle.current = null;
    resolve?.(outcome);
  }

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

  return {
    preparePages,
    cropping: cropping !== null,
    dialog: <PageCropDialog request={cropping} onResolve={onResolve} />,
  };
}
