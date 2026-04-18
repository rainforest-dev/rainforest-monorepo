import { notFound } from 'next/navigation';

import { EpubReader } from '@/components/EpubReader';
import { getBook } from '@/lib/queries';

export default async function ReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
