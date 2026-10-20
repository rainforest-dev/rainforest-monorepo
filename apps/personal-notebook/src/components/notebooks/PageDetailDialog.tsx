'use client';

import { type LibraryT, useLibraryT } from '@rainforest-dev/library-shell';
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

import { notebookPageFileName, withBase } from '@/lib';
import { NOTEBOOK_NAMESPACE } from '@/locales';
import type { NotebookPage } from '@/types';

import { pageImageUrl, readError } from './api';
import { useCropStep } from './use-crop-step';

// On a phone the actions share a row of equal cells, icon over label, as on the shelf's toolbar.
const action =
  'h-12 flex-col gap-0.5 px-1 text-xs leading-tight sm:h-8 sm:flex-row sm:gap-1.5 sm:px-2.5 sm:text-sm';

export const pageLabel = (page: NotebookPage, t: LibraryT) =>
  [
    t('page.label', { number: page.pageNumber ?? page.position }),
    page.pageDate,
    page.transcription ? t('page.transcribed') : null,
  ]
    .filter(Boolean)
    .join(' · ');

/** A page's scan, text and actions (download, replace, delete), shared by both notebook layouts. */
export function PageDetailDialog({
  notebookName,
  page: open,
  onClose,
}: {
  notebookName: string;
  page: NotebookPage | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useLibraryT(NOTEBOOK_NAMESPACE);
  const [deleting, setDeleting] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const replaceInput = useRef<HTMLInputElement>(null);
  const { preparePages, dialog: cropDialog } = useCropStep();

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
        toast.error(t('page.replaceOne'));
        return;
      }
      const form = new FormData();
      form.append('file', prepared[0]);
      const response = await fetch(
        withBase(`/api/notebooks/pages/${open.id}`),
        {
          method: 'PUT',
          body: form,
        },
      );
      if (!response.ok) {
        toast.error(await readError(response, t('page.replaceFailed')));
        return;
      }
      toast.success(t('page.replaced'));
      router.refresh();
    } catch {
      toast.error(t('page.replaceFailed'));
    } finally {
      setReplacing(false);
    }
  }

  async function deleteOpenPage() {
    if (!open || !window.confirm(t('page.confirmDelete'))) return;
    setDeleting(true);
    try {
      const response = await fetch(
        withBase(`/api/notebooks/pages/${open.id}`),
        {
          method: 'DELETE',
        },
      );
      if (!response.ok) {
        toast.error(await readError(response, t('page.deleteFailed')));
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{pageLabel(open, t)}</DialogTitle>
                <DialogDescription>
                  {notebookPageFileName({ notebookName, ...open })}
                  <span className="block text-xs">
                    {t('page.uploadedAs', { name: open.fileName })}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <img
                src={pageImageUrl(open.id)}
                alt={t('page.scanOf', { label: pageLabel(open, t) })}
                className="bg-muted max-h-[40dvh] w-full rounded-md object-contain sm:max-h-[70dvh]"
              />
              {open.transcription ? (
                <pre className="bg-muted whitespace-pre-wrap break-words rounded-md p-3 font-sans text-sm leading-relaxed">
                  {open.transcription}
                </pre>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t('page.notTranscribed')}
                </p>
              )}
              <DialogFooter className="bg-muted sticky -bottom-4 grid grid-cols-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex sm:pb-4">
                <a
                  href={pageImageUrl(open.id)}
                  download={notebookPageFileName({ notebookName, ...open })}
                  className={buttonVariants({
                    variant: 'outline',
                    className: action,
                  })}
                >
                  <FileDown aria-hidden />
                  <span>
                    {t('page.download')}
                    <span className="max-sm:sr-only">
                      {t('page.downloadMore')}
                    </span>
                  </span>
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
                  className={action}
                  disabled={replacing}
                  onClick={() => replaceInput.current?.click()}
                >
                  {replacing ? <Spinner /> : <ImageUp aria-hidden />}
                  <span>
                    {t('page.replace')}
                    <span className="max-sm:sr-only">
                      {t('page.replaceMore')}
                    </span>
                  </span>
                </Button>
                <Button
                  variant="destructive"
                  className={action}
                  disabled={deleting || replacing}
                  onClick={() => void deleteOpenPage()}
                >
                  <Trash2 aria-hidden />
                  <span>
                    {t('page.delete')}
                    <span className="max-sm:sr-only">
                      {t('page.deleteMore')}
                    </span>
                  </span>
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
