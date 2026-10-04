import {
  acquire,
  detectCapability,
  enableModel,
  selectTool,
} from '@rainforest-dev/web-ai';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { Person } from '@/lib/people.ts';
import type { SearchQuery } from '@/lib/search';

import { DEBOUNCE_MS } from './content-search.ts';
import {
  aiParseKey,
  buildPrompt,
  languagesFor,
  parseStaleTime,
  parseWithFallback,
  promptSchema,
  queryLanguage,
  readSwitch,
  statusFor,
  writeSwitch,
} from './prompt-parse.ts';

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
  peopleReady,
  open,
  composing,
  skip,
}: {
  raw: string;
  today: string;
  people: Person[];
  peopleReady: boolean;
  open: boolean;
  composing: boolean;
  skip: boolean;
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
    queryKey: aiParseKey(settled, today, people),
    queryFn: ({ signal }) =>
      parseWithFallback(
        settled,
        today,
        people,
        (text, inner) =>
          selectTool(buildPrompt(text, today, people), promptSchema(people), {
            signal: inner,
            languages: languagesFor(lang),
          }),
        signal,
      ),
    enabled:
      active && ready && peopleReady && !skip && Boolean(settled) && !composing,
    staleTime: (q) => parseStaleTime(q.state.data),
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

  const status = statusFor({
    supported,
    on,
    progress,
    capability: capability.data?.kind,
    lang,
    parsed: skip ? undefined : parse.data?.status,
  });

  const useAi = active && ready && !skip && Boolean(raw.trim());
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
