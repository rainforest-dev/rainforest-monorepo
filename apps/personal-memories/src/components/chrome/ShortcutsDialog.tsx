import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Kbd,
  KbdGroup,
  Separator,
} from '@rainforest-dev/rainforest-react';
import { XIcon } from 'lucide-react';

import { SHORTCUT_GROUPS } from '../../lib/shortcuts.ts';

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function ShortcutsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle>鍵盤快速鍵</DialogTitle>
          <DialogClose
            render={<Button variant="ghost" size="icon-sm" aria-label="關閉" />}
          >
            <XIcon />
          </DialogClose>
        </DialogHeader>
        {SHORTCUT_GROUPS.map((group, i) => (
          <section key={group.title ?? 'all'} className="flex flex-col gap-2">
            {i > 0 && <Separator />}
            {group.title && (
              <h3 className="text-muted-foreground text-xs">{group.title}</h3>
            )}
            <dl className="flex flex-col gap-1.5">
              {group.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4"
                >
                  <dt className="text-meta">{row.label}</dt>
                  <dd>
                    <KbdGroup>
                      {row.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </KbdGroup>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
}
