import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Kbd,
} from '@rainforest-dev/rainforest-react';
import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { DeskTab } from '@/lib/desk';

import { DESK_SEARCH_ATTR } from './useDeskShortcuts';

const DEBOUNCE_MS = 200;

export interface SearchFieldProps {
  value: string;
  label: string;
  tab: DeskTab;
  onChange: (value: string) => void;
}

export function SearchField({ value, label, tab, onChange }: SearchFieldProps) {
  const [text, setText] = useState(value);
  const [committed, setCommitted] = useState(value);

  if (value !== committed) {
    setCommitted(value);
    setText(value);
  }

  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed === committed) return;
    const timer = window.setTimeout(() => onChange(trimmed), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text, committed, onChange]);

  return (
    <InputGroup className="w-full sm:w-72" {...{ [DESK_SEARCH_ATTR]: tab }}>
      <InputGroupAddon>
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label={label}
        placeholder={label}
        autoComplete="off"
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="[&::-webkit-search-cancel-button]:appearance-none"
      />
      {!text && (
        <InputGroupAddon align="inline-end" className="max-lg:hidden">
          <Kbd>/</Kbd>
        </InputGroupAddon>
      )}
      {text && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label="Clear search"
            onClick={() => {
              setText('');
              onChange('');
            }}
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
