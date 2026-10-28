import { LibraryNotFound } from '@rainforest-dev/library-shell';

/** The root layout already puts the library bar around it. */
export default function NotFound() {
  return <LibraryNotFound current="notebooks" />;
}
