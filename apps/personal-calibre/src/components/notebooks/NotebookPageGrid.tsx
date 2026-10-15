'use client';

import {
  Button,
  buttonVariants,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
  toast,
} from '@rainforest-dev/rainforest-react';
import { FileDown, ImageUp, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, useRef, useState } from 'react';

import { notebookPageFileName } from '@/lib';
import type { NotebookPage } from '@/types';

import { pageImageUrl, readError } from './api';
import { useCropStep } from './use-crop-step';

const pageLabel = (page: NotebookPage) =>
  [
    `Page ${page.pageNumber ?? page.position}`,
    page.pageDate,
    page.transcription ? 'transcribed' : null,
  ]
    .filter(Boolean)
    .join(' · ');

export function NotebookPageGrid({
  notebookName,
  pages,
}: {
  notebookName: string;
  pages: readonly NotebookPage[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const replaceInput = useRef<HTMLInputElement>(null);
  const { preparePages, dialog: cropDialog } = useCropStep();
  const open = pages.find((page) => page.id === openId) ?? null;

  /**
   * Swaps the open page's image for a retake, through the same crop step as adding pages. The
   * page keeps its place; its transcription is cleared because it described the old image.
   */
  async function replaceOpenPage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!open || !file) return;
    setReplacing(true);
    try {
      const prepared = await preparePages([file]);
      if (!prepared) return;
      if (prepared.length !== 1) {
        toast.error('Replace takes one page; crop the photo to a single page');
        return;
      }
      const form = new FormData();
      form.append('file', prepared[0]);
      const response = await fetch(`/api/notebooks/pages/${open.id}`, {
        method: 'PUT',
        body: form,
      });
      if (!response.ok) {
        toast.error(await readError(response, 'Could not replace page'));
        return;
      }
      toast.success('Page replaced');
      router.refresh();
    } catch {
      toast.error('Could not replace page');
    } finally {
      setReplacing(false);
    }
  }

  async function deleteOpenPage() {
    if (!open || !window.confirm('Delete this page and its image?')) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/notebooks/pages/${open.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        toast.error(await readError(response, 'Could not delete page'));
        return;
      }
      setOpenId(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  if (pages.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        No pages yet. Add photos or scans of this notebook.
      </p>
    );
  }

  return (
    <>
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {pages.map((page) => (
          <li key={page.id}>
            <button
              type="button"
              onClick={() => setOpenId(page.id)}
              aria-label={pageLabel(page)}
              className="focus-visible:outline-ring group flex w-full flex-col gap-1 rounded-md text-left outline-offset-2 focus-visible:outline-2"
            >
              <div className="bg-muted relative aspect-[3/4] w-full overflow-hidden rounded-md border">
                <img
                  src={pageImageUrl(page.id)}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
                {page.transcription && (
                  <span
                    className="bg-success absolute right-1.5 top-1.5 size-2 rounded-full"
                    aria-hidden
                  />
                )}
              </div>
              <span className="text-muted-foreground text-xs tabular-nums">
                {page.pageNumber ?? page.position}
                {page.pageDate && ` · ${page.pageDate}`}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <Dialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{pageLabel(open)}</DialogTitle>
                <DialogDescription>
                  {notebookPageFileName({ notebookName, ...open })}
                  <span className="block text-xs">
                    Uploaded as {open.fileName}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <img
                src={pageImageUrl(open.id)}
                alt={`Scan of ${pageLabel(open)}`}
                className="bg-muted max-h-[70dvh] w-full rounded-md object-contain"
              />
              {open.transcription ? (
                <pre className="bg-muted whitespace-pre-wrap rounded-md p-3 font-sans text-sm">
                  {open.transcription}
                </pre>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Not transcribed yet.
                </p>
              )}
              <DialogFooter>
                <a
                  href={pageImageUrl(open.id)}
                  download={notebookPageFileName({ notebookName, ...open })}
                  className={buttonVariants({ variant: 'outline' })}
                >
                  <FileDown aria-hidden />
                  Download page
                </a>
                <input
                  ref={replaceInput}
                  type="file"
                  accept="image/*,application/pdf"
                  hidden
                  onChange={(event) => void replaceOpenPage(event)}
                />
                <Button
                  variant="outline"
                  disabled={replacing}
                  onClick={() => replaceInput.current?.click()}
                >
                  {replacing ? <Spinner /> : <ImageUp aria-hidden />}
                  Replace image
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleting || replacing}
                  onClick={() => void deleteOpenPage()}
                >
                  <Trash2 aria-hidden />
                  Delete page
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {cropDialog}
    </>
  );
}
