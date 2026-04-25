import Link from 'next/link';

interface Props {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}

export function buildPageUrl(
  page: number,
  params: Record<string, string | undefined>,
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== 'page') p.set(k, v);
  }
  if (page > 1) p.set('page', String(page));
  const qs = p.toString();
  return qs ? `/?${qs}` : '/';
}

const linkCls =
  'rounded-md border border-input px-3 py-1 text-sm hover:bg-muted transition-colors';
const disabledCls =
  'rounded-md border border-input px-3 py-1 text-sm text-muted-foreground cursor-not-allowed opacity-50';

export function Pagination({ page, totalPages, searchParams }: Props) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-3 text-sm"
    >
      {page > 1 ? (
        <Link href={buildPageUrl(page - 1, searchParams)} className={linkCls}>
          ← Prev
        </Link>
      ) : (
        <span className={disabledCls} aria-disabled="true">
          ← Prev
        </span>
      )}

      <span className="text-muted-foreground tabular-nums">
        Page {page} of {totalPages}
      </span>

      {page < totalPages ? (
        <Link href={buildPageUrl(page + 1, searchParams)} className={linkCls}>
          Next →
        </Link>
      ) : (
        <span className={disabledCls} aria-disabled="true">
          Next →
        </span>
      )}
    </nav>
  );
}
