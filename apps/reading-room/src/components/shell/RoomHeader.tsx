import {
  type CollectionId,
  type LibraryLocale,
} from '@rainforest-dev/library-contract';
import {
  CollectionNav,
  CollectionTabBar,
  LocaleSwitch,
  ShellHeader,
  useLibraryT,
  useReturnPoint,
} from '@rainforest-dev/library-shell';
import { cn } from '@rainforest-dev/rainforest-react';
import { Library, Newspaper } from 'lucide-react';

import { KB_PATH, RACK_PATH, SOURCES_PATH } from '@/lib/paths';
import { ROOM_NAMESPACE } from '@/locales';

import { RoomI18n } from './RoomI18n';

export type RoomSection = 'rack' | 'sources';

const SECTIONS: { id: RoomSection; href: string }[] = [
  { id: 'rack', href: RACK_PATH },
  { id: 'sources', href: SOURCES_PATH },
];

export interface RoomHeaderProps {
  locale: LibraryLocale;
  collection: CollectionId;
  /** The rack's page, for its section switcher; absent outside the rack. */
  section?: RoomSection;
  /**
   * Whether to link the library's other collections. Only on the library hostname: on the
   * old one, `/books` and the hall are not served.
   */
  collections: boolean;
}

/**
 * The library's shared top bar for every reading-room page, and the phone tab bar under it.
 * The bar keeps the shell's view-transition name, so a hop from another collection holds it
 * still.
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
  section,
  collections,
}: Omit<RoomHeaderProps, 'locale'>) {
  useReturnPoint(collection);
  const t = useLibraryT(ROOM_NAMESPACE);
  const kb = collection === 'kb';
  const Icon = kb ? Library : Newspaper;
  return (
    <>
      <ShellHeader>
        <a
          href={kb ? KB_PATH : RACK_PATH}
          className="flex h-10 items-center gap-2 rounded-md text-base font-semibold"
        >
          <Icon aria-hidden="true" className="text-primary size-4" />
          <h1>{kb ? t('header.kb') : t('header.room')}</h1>
        </a>
        {collections && <CollectionNav current={collection} resume />}
        {section && (
          <nav aria-label={t('header.sections')} className="ml-auto flex gap-1">
            {SECTIONS.map(({ id, href }) => (
              <a
                key={id}
                href={href}
                aria-current={id === section ? 'page' : undefined}
                className={cn(
                  'text-foreground hover:bg-accent flex h-10 items-center rounded-md px-3 text-sm',
                  id === section && 'bg-accent font-semibold',
                )}
              >
                {t(`header.${id}`)}
              </a>
            ))}
          </nav>
        )}
        <LocaleSwitch className={section ? undefined : 'ml-auto'} />
      </ShellHeader>
      {collections && <CollectionTabBar current={collection} resume />}
    </>
  );
}
