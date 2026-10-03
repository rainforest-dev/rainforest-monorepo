import {
  Button,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@rainforest-dev/rainforest-react';
import { ScanSearchIcon } from 'lucide-react';
import { useRef } from 'react';

import { useFeedValidation } from './useFeedValidation';
import { ValidateForm } from './ValidateForm';

export interface ValidatePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ValidatePopover({ open, onOpenChange }: ValidatePopoverProps) {
  const validation = useFeedValidation();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" aria-label="Validate URL" />
        }
      >
        <ScanSearchIcon data-icon="inline-start" />
        <span className="max-lg:hidden">Validate URL</span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        initialFocus={inputRef}
        className="w-96 max-w-[calc(100vw-2rem)] gap-3 p-4"
      >
        <PopoverHeader>
          <PopoverTitle className="text-base">Validate a feed</PopoverTitle>
          <PopoverDescription>
            Check a URL before proposing it as a source.
          </PopoverDescription>
        </PopoverHeader>
        <ValidateForm validation={validation} inputRef={inputRef} />
      </PopoverContent>
    </Popover>
  );
}
