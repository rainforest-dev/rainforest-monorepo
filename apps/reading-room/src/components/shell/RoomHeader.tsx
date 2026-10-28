import {
  type CollectionId,
  type LibraryLocale,
} from '@rainforest-dev/library-contract';
import {
  LibraryBar,
  type SectionItem,
  SectionNav,
  useLibraryT,
} from '@rainforest-dev/library-shell';

import { ROOM_NAMESPACE } from '@/locales';

import { RoomI18n } from './RoomI18n';

/** A collection's second level, labelled on the server, where the page knows its data. */
export interface RoomSections {
  label: string;
  items: SectionItem[];
  current?: string;
}

export interface RoomHeaderProps {
  locale: LibraryLocale;
  collection: CollectionId;
  /** The row under the bar: the rack's pages, or the knowledge base's sources. */
  sections?: RoomSections;
  /**
   * Whether to link the library's other collections. Only on the library hostname: on the
   * old one, `/books` and the hall are not served.
   */
  collections: boolean;
}

/**
 * The library's shared top bar for every reading-room page, with the collection's sections in
 * the row under it, and the phone tab bar. The bar keeps the shell's view-transition name, so a
 * hop from another collection holds it still.
 */
export function RoomHeader({ locale, ...props }: RoomHeaderProps) {
  return (
    <RoomI18n locale={locale}>
      <RoomBar {...props} />
    </RoomI18n>
  );
}

function RoomBar({
  collection,
  sections,
  collections,
}: Omit<RoomHeaderProps, 'locale'>) {
  const t = useLibraryT(ROOM_NAMESPACE);
  return (
    <LibraryBar
      current={collection}
      collections={collections}
      sections={sections && <SectionNav {...sections} />}
    >
      {/* The bar names the library; the page's own name is for assistive tech. */}
      <h1 className="sr-only">
        {collection === 'kb'
          ? t('header.kb')
          : collection === 'magazines'
            ? t('events.title')
            : t('header.room')}
      </h1>
    </LibraryBar>
  );
}
