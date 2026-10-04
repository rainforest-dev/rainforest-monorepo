import { Label, Switch } from '@rainforest-dev/rainforest-react';
import { useId } from 'react';

import { type ParseStatus, statusText } from './prompt-parse.ts';

type Props = {
  on: boolean;
  supported: boolean;
  status: ParseStatus;
  onToggle: (next: boolean) => void;
};

export function AiParseSwitch({ on, supported, status, onToggle }: Props) {
  const id = useId();
  const text = statusText(status);
  return (
    <div className="border-border flex flex-col gap-1 border-t px-3 py-2">
      <div className="flex items-center gap-2">
        <Switch
          id={id}
          size="sm"
          checked={on && supported}
          disabled={!supported}
          onCheckedChange={(next) => onToggle(next)}
        />
        <Label htmlFor={id} className="text-xs font-normal">
          AI 解析查詢（實驗）
        </Label>
      </div>
      {text && (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {text}
        </p>
      )}
    </div>
  );
}
