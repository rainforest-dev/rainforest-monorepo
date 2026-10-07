import type { NavItem } from '@rainforest-dev/rainforest-ui/interaction';

import type { StudyBook, StudyShelf } from './model';

export const MODEL_PX_PER_UNIT = 100;
export const ROW_H = 2.6;
export const FRONT_Z = 0.1;
export const BOOK_GAP = 0.015;
export const GROUP_GAP = 0.5;
export const LABEL_GAP = 0.2;

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
  width: number;
  top: number;
}

export type LabelWidth = (shelf: StudyShelf, continued: boolean) => number;

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
  width: 0,
  top: (1 - row) * ROW_H,
});

function fitLabelWidths(labels: ShelfLabel[], widthUnits: number): void {
  labels.forEach((label, i) => {
    const next = labels[i + 1];
    const end =
      next && next.row === label.row ? next.x - LABEL_GAP : widthUnits;
    label.width = Math.max(end - label.x, 0);
  });
}

export function layoutShelves(
  shelves: readonly StudyShelf[],
  widthUnits: number,
  labelWidth: LabelWidth = () => 0,
): StudyLayout {
  const books: PlacedBook[] = [];
  const boards: Board[] = [];
  const labels: ShelfLabel[] = [];
  let row = 0;
  let x = 0;
  let labelEnd = 0;
  const label = (shelf: StudyShelf, at: number, continued: boolean) => {
    labels.push(labelAt(shelf, row, at, continued));
    labelEnd = at + Math.min(labelWidth(shelf, continued), widthUnits - at);
  };
  for (const shelf of shelves) {
    if (x > 0) {
      const books3 = shelf.books
        .slice(0, 3)
        .reduce((sum, book) => sum + thickness(book) + BOOK_GAP, 0);
      const need = Math.max(
        books3,
        Math.min(labelWidth(shelf, shelf.continued), widthUnits),
      );
      const start = Math.max(x + GROUP_GAP, labelEnd + LABEL_GAP);
      if (start + need > widthUnits) {
        row += 1;
        x = 0;
        labelEnd = 0;
      } else {
        boards.push({
          x: start - GROUP_GAP / 2,
          y: -row * ROW_H + (ROW_H - 0.1) / 2,
          z: -0.6,
          sx: 0.06,
          sy: ROW_H - 0.1,
          sz: 1.5,
        });
        x = start;
      }
    }
    let labelled = false;
    for (const book of shelf.books) {
      const t = thickness(book);
      const h = book.dims.height / MODEL_PX_PER_UNIT;
      if (x + t > widthUnits && x > 0) {
        row += 1;
        x = 0;
        label(shelf, 0, true);
        labelled = true;
      }
      if (!labelled) {
        label(shelf, x, shelf.continued);
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
  fitLabelWidths(labels, widthUnits);
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
