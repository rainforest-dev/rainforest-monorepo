import { useLibraryT } from '@rainforest-dev/library-shell';
import { Button } from '@rainforest-dev/rainforest-react';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';

import { ROOM_NAMESPACE } from '@/locales';

export interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

export function Pager({ page, pageSize, total, onPage }: PagerProps) {
  const t = useLibraryT(ROOM_NAMESPACE);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label={t('desk.pager.label')}
      className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"
    >
      <p className="text-muted-foreground tabular-nums">
        {t('desk.pager.range', { first, last, total })}
      </p>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
          {t('desk.pager.prev')}
        </Button>
        <span className="tabular-nums">
          {t('desk.pager.page', { page, count: pageCount })}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          {t('desk.pager.next')}
          <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
