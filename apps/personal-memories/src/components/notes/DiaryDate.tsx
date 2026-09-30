import { diaryDate } from '../../lib/weeks.ts';

export function DiaryDate({ date }: { date: string }) {
  const { day, meta } = diaryDate(date);
  return (
    <p className="flex items-baseline gap-2">
      <time
        dateTime={date}
        className="text-title font-semibold tabular-nums tracking-[-0.01em]"
      >
        {day}
      </time>
      <span className="text-meta text-muted-foreground tabular-nums">
        {meta}
      </span>
    </p>
  );
}
