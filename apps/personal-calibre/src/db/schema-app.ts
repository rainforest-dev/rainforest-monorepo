import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';

export const deliveryPlatforms = sqliteTable('delivery_platforms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const bookDeliveries = sqliteTable('book_deliveries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookId: integer('book_id').notNull(),
  platformId: integer('platform_id')
    .notNull()
    .references(() => deliveryPlatforms.id),
  addedAt: text('added_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  note: text('note'),
  externalRef: text('external_ref'),
});

export const notebooks = sqliteTable('notebooks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  status: text('status', { enum: ['active', 'archived'] })
    .notNull()
    .default('active'),
  startedOn: text('started_on'),
  endedOn: text('ended_on'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const notebookPages = sqliteTable(
  'notebook_pages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id),
    position: integer('position').notNull(),
    pageNumber: integer('page_number'),
    pageDate: text('page_date'),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    bytes: integer('bytes').notNull(),
    contentHash: text('content_hash').notNull(),
    transcription: text('transcription'),
    transcribedAt: text('transcribed_at'),
    source: text('source'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_notebook_pages_notebook_position').on(
      table.notebookId,
      table.position,
    ),
    unique().on(table.notebookId, table.contentHash),
  ],
);
