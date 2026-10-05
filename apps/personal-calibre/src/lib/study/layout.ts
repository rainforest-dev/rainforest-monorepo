import type { NavItem } from '@rainforest-dev/rainforest-ui/interaction';

import type { StudyBook, StudyShelf } from './model';

export const MODEL_PX_PER_UNIT = 100;
export const ROW_H = 2.6;
export const FRONT_Z = 0.1;
export const BOOK_GAP = 0.015;
export const GROUP_GAP = 0.5;

export interface PlacedBook {
  book: StudyBook;
  shelfKey: string;
  row: number;
  order: number;
  x: number;
  y: number;
  t: number;
  h: number;
  d: number;
}

export interface Board {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
}

export interface ShelfLabel {
  shelfKey: string;
  text: string;
  count: number;
  continued: boolean;
  row: number;
  x: number;
  top: number;
}

export interface StudyLayout {
  books: PlacedBook[];
  boards: Board[];
  labels: ShelfLabel[];
  rows: number;
  width: number;
}

const thickness = (book: StudyBook) => book.dims.width / MODEL_PX_PER_UNIT;

const labelAt = (
  shelf: StudyShelf,
  row: number,
  x: number,
  continued: boolean,
): ShelfLabel => ({
  shelfKey: shelf.key,
  text: shelf.label,
  count: shelf.count,
  continued,
  row,
  x,
  top: (1 - row) * ROW_H,
});

export function layoutShelves(
  shelves: readonly StudyShelf[],
  widthUnits: number,
): StudyLayout {
  const books: PlacedBook[] = [];
  const boards: Board[] = [];
  const labels: ShelfLabel[] = [];
  let row = 0;
  let x = 0;
  for (const shelf of shelves) {
    if (x > 0) {
      const need = shelf.books
        .slice(0, 3)
        .reduce((sum, book) => sum + thickness(book) + BOOK_GAP, 0);
      if (x + GROUP_GAP + need > widthUnits) {
        row += 1;
        x = 0;
      } else {
        boards.push({
          x: x + GROUP_GAP / 2,
          y: -row * ROW_H + (ROW_H - 0.1) / 2,
          z: -0.6,
          sx: 0.06,
          sy: ROW_H - 0.1,
          sz: 1.5,
        });
        x += GROUP_GAP;
      }
    }
    let labelled = false;
    for (const book of shelf.books) {
      const t = thickness(book);
      const h = book.dims.height / MODEL_PX_PER_UNIT;
      if (x + t > widthUnits && x > 0) {
        row += 1;
        x = 0;
        labels.push(labelAt(shelf, row, 0, true));
        labelled = true;
      }
      if (!labelled) {
        labels.push(labelAt(shelf, row, x, shelf.continued));
        labelled = true;
      }
      books.push({
        book,
        shelfKey: shelf.key,
        row,
        order: books.length,
        x: x + t / 2,
        y: -row * ROW_H + h / 2,
        t,
        h,
        d: book.dims.depth / MODEL_PX_PER_UNIT,
      });
      x += t + BOOK_GAP;
    }
  }
  for (let r = 0; r <= row; r += 1) {
    boards.push({
      x: widthUnits / 2,
      y: -r * ROW_H - 0.05,
      z: -0.6,
      sx: widthUnits + 0.6,
      sy: 0.1,
      sz: 1.6,
    });
  }
  return { books, boards, labels, rows: row + 1, width: widthUnits };
}

export function studyNavItems(layout: StudyLayout): NavItem[] {
  return layout.books.map((placed) => ({
    key: placed.book.navKey,
    row: placed.row,
    order: placed.order,
    col: placed.x,
  }));
}

export function booksInRow(layout: StudyLayout, row: number): PlacedBook[] {
  return layout.books.filter((placed) => placed.row === row);
}
