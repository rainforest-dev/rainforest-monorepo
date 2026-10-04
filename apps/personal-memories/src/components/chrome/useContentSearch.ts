import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { Person } from '@/lib/people.ts';
import type { SearchQuery } from '@/lib/search';
import type { SearchResponse } from '@/lib/server';

import { DEBOUNCE_MS, searchUrl, shouldSearch } from './content-search.ts';

const getJson = async <T>(url: string, signal: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return (await response.json()) as T;
};

export function usePeople(enabled: boolean): {
  people: Person[];
  ready: boolean;
} {
  const { data, isSuccess, isError } = useQuery({
    queryKey: ['people'],
    queryFn: ({ signal }) => getJson<Person[]>('/people.json', signal),
    enabled,
    staleTime: Infinity,
  });
  return { people: data ?? [], ready: isSuccess || isError };
}

export function useContentSearch(
  query: SearchQuery | undefined,
  composing: boolean,
) {
  const url =
    query && shouldSearch(query, composing) ? searchUrl(query) : undefined;
  const [settled, setSettled] = useState<string>();
  useEffect(() => {
    if (!url) {
      setSettled(undefined);
      return;
    }
    const timer = setTimeout(() => setSettled(url), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [url]);
  const current = url !== undefined && settled === url;
  const { data, isFetching, isError } = useQuery({
    queryKey: ['search', settled],
    queryFn: ({ signal }) => getJson<SearchResponse>(settled ?? '', signal),
    enabled: current,
    staleTime: 60_000,
    retry: false,
  });
  return {
    results: current ? (data?.results ?? []) : [],
    reason: current ? data?.reason : undefined,
    loading: Boolean(url) && (!current || isFetching),
    error: current && isError,
  };
}
