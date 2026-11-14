import type { APIRoute } from 'astro';

import { printListCsv } from '@/lib';
import {
  isInsideOut,
  notesStore,
  orbContext,
  orbItems,
  printRows,
} from '@/lib/server';

export const GET: APIRoute = async ({ params, request }) => {
  const year = params.year ?? '';
  if (!isInsideOut() || !/^\d{4}$/.test(year))
    return new Response('Not found', { status: 404 });
  const ctx = await orbContext(request.headers);
  const items = orbItems(ctx.file, ctx.state).filter((i) =>
    i.date.startsWith(`${year}-`),
  );
  const csv = printListCsv(printRows(items, ctx.pair, ctx.state, notesStore()));
  return new Response(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="core-memories-${year}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
};
