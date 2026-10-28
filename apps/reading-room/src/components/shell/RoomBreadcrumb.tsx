import {
  type CollectionId,
  type LibraryLocale,
} from '@rainforest-dev/library-contract';
import { type Crumb, LibraryBreadcrumb } from '@rainforest-dev/library-shell';

import { RoomI18n } from './RoomI18n';

/** The library's breadcrumb on a reading-room page. Plain links, so it needs no hydration. */
export function RoomBreadcrumb({
  locale,
  ...props
}: {
  locale: LibraryLocale;
  current: CollectionId;
  trail?: Crumb[];
  page: string;
  className?: string;
}) {
  return (
    <RoomI18n locale={locale}>
      <LibraryBreadcrumb {...props} />
    </RoomI18n>
  );
}
