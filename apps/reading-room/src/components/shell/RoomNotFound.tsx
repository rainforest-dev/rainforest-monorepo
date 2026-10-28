import {
  type CollectionId,
  type LibraryLocale,
} from '@rainforest-dev/library-contract';
import { LibraryNotFound } from '@rainforest-dev/library-shell';

import { RoomI18n } from './RoomI18n';

/** The library's not-found page for the rack and the knowledge base. It needs no hydration. */
export function RoomNotFound({
  locale,
  collection,
}: {
  locale: LibraryLocale;
  collection: CollectionId;
}) {
  return (
    <RoomI18n locale={locale}>
      <LibraryNotFound current={collection} />
    </RoomI18n>
  );
}
