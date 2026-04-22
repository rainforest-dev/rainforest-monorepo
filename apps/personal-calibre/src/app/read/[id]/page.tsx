import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { EpubReader } from '@/components/EpubReader';
import { getBook } from '@/lib/queries';

interface Props {
  params: Promise<{ id: string }>;
}

export default function ReadPage({
  params,
}: Props) {
  return (
    <Suspense fallback={<div className="bg-background h-screen w-screen" />}>
      <ReadPageContent params={params} />
    </Suspense>
  );
}

async function ReadPageContent({ params }: Props) {
  const { id } = await params;
  const bookId = Number(id);

  if (Number.isNaN(bookId)) notFound();

  const book = await getBook(bookId);

  if (!book) notFound();

  if (!book.formats.map((f) => f.toLowerCase()).includes('epub')) notFound();

  return (
    <div className="bg-background h-screen w-screen overflow-hidden">
      <EpubReader bookId={bookId} title={book.title} />
    </div>
  );
}
