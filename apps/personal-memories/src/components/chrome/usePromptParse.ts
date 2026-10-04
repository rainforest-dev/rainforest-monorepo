import {
  acquire,
  detectCapability,
  enableModel,
  type LanguageOptions,
  selectTool,
} from '@rainforest-dev/web-ai';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { Person } from '@/lib/people.ts';
import type { SearchQuery } from '@/lib/search';

import { DEBOUNCE_MS } from './content-search.ts';
import {
  buildPrompt,
  type ParseStatus,
  parseWithFallback,
  promptSchema,
  queryLanguage,
  readSwitch,
  writeSwitch,
} from './prompt-parse.ts';

const languagesFor = (lang: string): LanguageOptions => ({
  input: ['en', lang],
  output: ['en'],
});

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

export function usePromptParse({
  raw,
  today,
  people,
  open,
  composing,
}: {
  raw: string;
  today: string;
  people: Person[];
  open: boolean;
  composing: boolean;
}) {
  const client = useQueryClient();
  const [on, setOn] = useState(false);
  const [supported, setSupported] = useState(false);
  const [progress, setProgress] = useState<number>();
  useEffect(() => {
    setOn(readSwitch(globalThis.localStorage));
    setSupported('LanguageModel' in globalThis);
  }, []);
  useEffect(() => (on && supported ? acquire() : undefined), [on, supported]);

  const settled = useDebounced(raw.trim(), DEBOUNCE_MS);
  const lang = queryLanguage(settled);
  const active = open && on && supported;
  const capability = useQuery({
    queryKey: ['ai-capability', lang],
    queryFn: () => detectCapability(languagesFor(lang)),
    enabled: active,
    staleTime: Infinity,
  });
  const ready = capability.data?.kind === 'ready';
  const parse = useQuery({
    queryKey: ['ai-parse', settled, today],
    queryFn: () =>
      parseWithFallback(settled, today, people, (text, signal) =>
        selectTool(buildPrompt(text, today, people), promptSchema(people), {
          signal,
          languages: languagesFor(lang),
        }),
      ),
    enabled: active && ready && Boolean(settled) && !composing,
    staleTime: Infinity,
    retry: false,
  });

  const toggle = async (next: boolean) => {
    setOn(next);
    writeSwitch(globalThis.localStorage, next);
    if (!next || !supported) return;
    const languages = languagesFor(queryLanguage(raw));
    const state = await detectCapability(languages);
    if (state.kind === 'downloadable') {
      setProgress(0);
      await enableModel(setProgress, languages).catch(() => undefined);
      setProgress(undefined);
    }
    await client.invalidateQueries({ queryKey: ['ai-capability'] });
  };

  let status: ParseStatus = { kind: 'off' };
  if (!supported) status = { kind: 'unsupported-browser' };
  else if (!on) status = { kind: 'off' };
  else if (progress !== undefined) status = { kind: 'downloading', progress };
  else if (capability.data?.kind === 'unavailable')
    status = { kind: 'unsupported-language', lang };
  else if (capability.data?.kind === 'unsupported')
    status = { kind: 'unavailable' };
  else if (capability.data?.kind === 'downloadable')
    status = { kind: 'needs-download' };
  else if (capability.data?.kind === 'downloading')
    status = { kind: 'downloading', progress: 0 };
  else if (parse.data) status = { kind: parse.data.status };

  const useAi = active && ready && Boolean(raw.trim());
  const aiQuery: SearchQuery | undefined =
    useAi && settled === raw.trim() ? parse.data?.query : undefined;
  return {
    on,
    supported,
    toggle,
    status,
    useAi,
    aiQuery,
    pending: useAi && (settled !== raw.trim() || parse.isFetching),
  };
}
