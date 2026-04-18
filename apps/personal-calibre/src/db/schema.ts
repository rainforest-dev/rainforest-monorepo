import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const books = sqliteTable('books', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  sort: text('sort'),
  timestamp: text('timestamp'),
  pubdate: text('pubdate'),
  seriesIndex: real('series_index'),
  authorSort: text('author_sort'),
  path: text('path').notNull(),
  hasCover: integer('has_cover', { mode: 'boolean' }).default(false),
  uuid: text('uuid'),
  lastModified: text('last_modified'),
});

export const authors = sqliteTable('authors', {
  id: integer('id').primaryKey(),
  name: text('name'),
  sort: text('sort'),
  link: text('link'),
});

export const booksAuthorsLink = sqliteTable('books_authors_link', {
  id: integer('id').primaryKey(),
  book: integer('book'),
  author: integer('author'),
});

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey(),
  name: text('name'),
});

export const booksTagsLink = sqliteTable('books_tags_link', {
  id: integer('id').primaryKey(),
  book: integer('book'),
  tag: integer('tag'),
});

export const series = sqliteTable('series', {
  id: integer('id').primaryKey(),
  name: text('name'),
  sort: text('sort'),
});

export const booksSeriesLink = sqliteTable('books_series_link', {
  id: integer('id').primaryKey(),
  book: integer('book'),
  series: integer('series'),
});

export const publishers = sqliteTable('publishers', {
  id: integer('id').primaryKey(),
  name: text('name'),
  sort: text('sort'),
});

export const booksPublishersLink = sqliteTable('books_publishers_link', {
  id: integer('id').primaryKey(),
  book: integer('book'),
  publisher: integer('publisher'),
});

export const data = sqliteTable('data', {
  id: integer('id').primaryKey(),
  book: integer('book'),
  format: text('format'),
  uncompressedSize: integer('uncompressed_size'),
  name: text('name'),
});

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey(),
  book: integer('book'),
  text: text('text'),
});

export const ratings = sqliteTable('ratings', {
  id: integer('id').primaryKey(),
  rating: integer('rating'),
});

export const booksRatingsLink = sqliteTable('books_ratings_link', {
  id: integer('id').primaryKey(),
  book: integer('book'),
  rating: integer('rating'),
});

export const languages = sqliteTable('languages', {
  id: integer('id').primaryKey(),
  langCode: text('lang_code'),
});

export const booksLanguagesLink = sqliteTable('books_languages_link', {
  id: integer('id').primaryKey(),
  book: integer('book'),
  langCode: integer('lang_code'),
  itemOrder: integer('item_order'),
});
