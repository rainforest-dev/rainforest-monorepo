import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@rainforest-dev/rainforest-react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = { prev?: string | undefined; next?: string | undefined };

function Step({
  month,
  label,
  children,
}: {
  month: string | undefined;
  label: string;
  children: ReactNode;
}) {
  const button = month ? (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      nativeButton={false}
      render={<a href={`/month/${month}`} />}
    />
  ) : (
    <Button variant="ghost" size="icon" aria-label={label} disabled />
  );
  return (
    <Tooltip>
      <TooltipTrigger render={button}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function MonthNav({ prev, next }: Props) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <Step month={prev} label="上個月">
          <ChevronLeftIcon />
        </Step>
        <Step month={next} label="下個月">
          <ChevronRightIcon />
        </Step>
      </div>
    </TooltipProvider>
  );
}
