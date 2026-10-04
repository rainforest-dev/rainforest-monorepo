import { ToolInputError } from '@rainforest-dev/mcp-kit';
import { and, desc, eq } from 'drizzle-orm';
import { revalidateTag, unstable_noStore as noStore } from 'next/cache';

import { appDb, bookDeliveries, deliveryPlatforms } from '@/db';
import { isHttpUrl } from '@/lib/url';
import type {
  BookDeliveryEvent,
  CreateDeliveryEventInput,
  DeliveryPlatform,
} from '@/types';

export function normalizeExternalRef(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  if (!isHttpUrl(trimmed)) {
    throw new Error('externalRef must use http or https');
  }
  return trimmed;
}

export async function listDeliveryPlatforms(): Promise<DeliveryPlatform[]> {
  noStore();

  const rows = await appDb
    .select({
      id: deliveryPlatforms.id,
      key: deliveryPlatforms.key,
      name: deliveryPlatforms.name,
    })
    .from(deliveryPlatforms)
    .orderBy(deliveryPlatforms.name);

  return rows;
}

export async function listBookDeliveryEvents(
  bookId: number,
): Promise<BookDeliveryEvent[]> {
  noStore();

  const rows = await appDb
    .select({
      id: bookDeliveries.id,
      bookId: bookDeliveries.bookId,
      platformKey: deliveryPlatforms.key,
      platformName: deliveryPlatforms.name,
      addedAt: bookDeliveries.addedAt,
      note: bookDeliveries.note,
      externalRef: bookDeliveries.externalRef,
    })
    .from(bookDeliveries)
    .innerJoin(
      deliveryPlatforms,
      eq(deliveryPlatforms.id, bookDeliveries.platformId),
    )
    .where(eq(bookDeliveries.bookId, bookId))
    .orderBy(desc(bookDeliveries.id));

  return rows;
}

export async function createBookDeliveryEvent(
  bookId: number,
  input: CreateDeliveryEventInput,
): Promise<void> {
  const platformKey = input.platformKey.trim();

  if (!platformKey) {
    throw new ToolInputError('platformKey is required');
  }

  const externalRef = normalizeExternalRef(input.externalRef);

  const platform = await appDb
    .select({ id: deliveryPlatforms.id })
    .from(deliveryPlatforms)
    .where(eq(deliveryPlatforms.key, platformKey))
    .get();

  if (!platform) {
    throw new ToolInputError('Unknown delivery platform');
  }

  await appDb.insert(bookDeliveries).values({
    bookId,
    platformId: platform.id,
    addedAt: new Date().toISOString(),
    note: input.note?.trim() || null,
    externalRef,
  });

  revalidateTag('books', { expire: 0 });
  revalidateTag(`book-${bookId}`, { expire: 0 });
}

export async function deleteBookDeliveryEvent(
  bookId: number,
  deliveryId: number,
): Promise<void> {
  await appDb
    .delete(bookDeliveries)
    .where(
      and(eq(bookDeliveries.id, deliveryId), eq(bookDeliveries.bookId, bookId)),
    );

  revalidateTag('books', { expire: 0 });
  revalidateTag(`book-${bookId}`, { expire: 0 });
}

export async function bulkCreateDeliveryEvents(
  bookIds: number[],
  input: CreateDeliveryEventInput,
): Promise<{ count: number }> {
  const platformKey = input.platformKey.trim();

  if (!platformKey) {
    throw new ToolInputError('platformKey is required');
  }

  const externalRef = normalizeExternalRef(input.externalRef);

  const platform = await appDb
    .select({ id: deliveryPlatforms.id })
    .from(deliveryPlatforms)
    .where(eq(deliveryPlatforms.key, platformKey))
    .get();

  if (!platform) {
    throw new ToolInputError('Unknown delivery platform');
  }

  const now = new Date().toISOString();

  await appDb.insert(bookDeliveries).values(
    bookIds.map((bookId) => ({
      bookId,
      platformId: platform.id,
      addedAt: now,
      note: input.note?.trim() || null,
      externalRef,
    })),
  );

  revalidateTag('books', { expire: 0 });
  for (const bookId of bookIds) {
    revalidateTag(`book-${bookId}`, { expire: 0 });
  }

  return { count: bookIds.length };
}
