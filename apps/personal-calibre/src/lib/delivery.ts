import { and, desc, eq } from 'drizzle-orm';
import { revalidateTag, unstable_noStore as noStore } from 'next/cache';

import { appDb } from '@/db/client';
import { bookDeliveries, deliveryPlatforms } from '@/db/schema-app';
import type {
  BookDeliveryEvent,
  CreateDeliveryEventInput,
  DeliveryPlatform,
} from '@/types/delivery';

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
    throw new Error('platformKey is required');
  }

  const platform = await appDb
    .select({ id: deliveryPlatforms.id })
    .from(deliveryPlatforms)
    .where(eq(deliveryPlatforms.key, platformKey))
    .get();

  if (!platform) {
    throw new Error('Unknown delivery platform');
  }

  await appDb.insert(bookDeliveries).values({
    bookId,
    platformId: platform.id,
    addedAt: new Date().toISOString(),
    note: input.note?.trim() || null,
    externalRef: input.externalRef?.trim() || null,
  });

  revalidateTag(`book-${bookId}`, 'max');
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

  revalidateTag(`book-${bookId}`, 'max');
}
