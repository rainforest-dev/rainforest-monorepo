'use client';

import {
  type CollectionId,
  type LibraryMessage,
} from '@rainforest-dev/library-contract';
import { useEffect, useRef } from 'react';

import { openLibraryChannel, rememberReturnPoint } from './shared-state';

/** Calls `onMessage` for every notice another tab posts on the library channel. */
export function useLibraryChannel(onMessage: (m: LibraryMessage) => void) {
  const handler = useRef(onMessage);
  useEffect(() => {
    handler.current = onMessage;
  });
  useEffect(() => {
    const channel = openLibraryChannel((m) => handler.current(m));
    return channel.close;
  }, []);
}

/**
 * Records the current URL as the collection's return point whenever the page is hidden or
 * left, so coming back through the shell lands where the reader was.
 */
export function useReturnPoint(collection: CollectionId) {
  useEffect(() => {
    const save = () =>
      rememberReturnPoint(
        collection,
        window.location.pathname + window.location.search,
      );
    window.addEventListener('pagehide', save);
    return () => {
      save();
      window.removeEventListener('pagehide', save);
    };
  }, [collection]);
}
