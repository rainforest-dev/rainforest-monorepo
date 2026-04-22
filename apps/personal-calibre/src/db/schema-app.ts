import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const deliveryPlatforms = sqliteTable('delivery_platforms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const bookDeliveries = sqliteTable('book_deliveries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookId: integer('book_id').notNull(),
  platformId: integer('platform_id')
    .notNull()
    .references(() => deliveryPlatforms.id),
  addedAt: text('added_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  note: text('note'),
  externalRef: text('external_ref'),
});
