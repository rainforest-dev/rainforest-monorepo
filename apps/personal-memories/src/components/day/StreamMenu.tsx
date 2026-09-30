import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@rainforest-dev/rainforest-react';

import { useStreamMenu } from './useStreamMenu.ts';

type ViewProps = {
  at: { x: number; y: number } | undefined;
  onClose: () => void;
  onAnnotate: () => void;
  onCopy: () => void;
};

export function StreamMenuView({ at, onClose, onAnnotate, onCopy }: ViewProps) {
  return (
    <DropdownMenu
      open={at !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DropdownMenuTrigger
        nativeButton={false}
        render={
          <span
            aria-hidden
            className="pointer-events-none fixed size-px"
            style={{ left: at?.x ?? 0, top: at?.y ?? 0 }}
          />
        }
      />
      <DropdownMenuContent className="w-40" finalFocus={false}>
        <DropdownMenuItem onClick={onAnnotate}>眉批</DropdownMenuItem>
        <DropdownMenuItem onClick={onCopy}>複製</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StreamMenu() {
  const menu = useStreamMenu();
  return (
    <StreamMenuView
      at={menu.at}
      onClose={menu.close}
      onAnnotate={menu.annotate}
      onCopy={menu.copy}
    />
  );
}
