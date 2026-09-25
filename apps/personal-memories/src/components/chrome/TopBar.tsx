import {
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Kbd,
  Tabs,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@rainforest-dev/rainforest-react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  KeyboardIcon,
  SearchIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { Level } from '../../lib/nav.ts';

const LEVELS: { value: Level; label: string }[] = [
  { value: 'year', label: '年' },
  { value: 'month', label: '月' },
  { value: 'day', label: '日' },
];

type Props = {
  level: Level;
  hrefs: Record<Level, string>;
  onJump: () => void;
  onKeys: () => void;
  onStep?: ((delta: -1 | 1) => void) | undefined;
};

function IconTip({
  label,
  tip,
  onClick,
  className,
  children,
}: {
  label: string;
  tip: ReactNode;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            className={className}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

export function TopBar({ level, hrefs, onJump, onKeys, onStep }: Props) {
  return (
    <header className="border-border mb-6 flex h-14 items-center gap-3 border-b">
      <a href="/" className="text-heading font-semibold">
        回憶
      </a>
      <Tabs value={level}>
        <TabsList aria-label="縮放">
          {LEVELS.map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              nativeButton={false}
              render={<a href={hrefs[value]} />}
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {onStep && (
        <div className="flex items-center">
          <IconTip
            label="前一天"
            tip={
              <>
                前一天 <Kbd>k</Kbd>
              </>
            }
            onClick={() => onStep(-1)}
          >
            <ChevronLeftIcon />
          </IconTip>
          <IconTip
            label="後一天"
            tip={
              <>
                後一天 <Kbd>j</Kbd>
              </>
            }
            onClick={() => onStep(1)}
          >
            <ChevronRightIcon />
          </IconTip>
        </div>
      )}
      <div className="flex-1" />
      <InputGroup className="relative hidden w-56 sm:flex">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          readOnly
          tabIndex={-1}
          aria-hidden
          placeholder="跳至日期"
        />
        <InputGroupAddon align="inline-end">
          <Kbd>/</Kbd>
        </InputGroupAddon>
        <button
          type="button"
          aria-label="跳至日期"
          onClick={onJump}
          className="focus-visible:ring-ring absolute inset-0 rounded-lg outline-none focus-visible:ring-2"
        />
      </InputGroup>
      <IconTip
        label="跳至日期"
        tip="跳至日期"
        onClick={onJump}
        className="sm:hidden"
      >
        <SearchIcon />
      </IconTip>
      <IconTip label="鍵盤快速鍵" tip="按 ? 看所有快速鍵" onClick={onKeys}>
        <KeyboardIcon />
      </IconTip>
    </header>
  );
}
