'use client';

import {
  COLLECTION_ICONS,
  CollectionNav,
  LocaleSwitch,
  ShellHeader,
  ShellSearch,
  useLibraryT,
} from '@rainforest-dev/library-shell';

import { HALL_NAMESPACE } from '@/locales';

const HallIcon = COLLECTION_ICONS.hall;

/** The shared top bar, as the hall shows it: the library's name, the collection switcher and the library-wide search. */
export function HallHeader() {
  const t = useLibraryT(HALL_NAMESPACE);
  return (
    <ShellHeader>
      <a
        href="/"
        className="flex items-center gap-2 font-semibold tracking-tight"
      >
        <HallIcon className="text-primary size-5" aria-hidden />
        {t('header.name')}
      </a>
      <CollectionNav current="hall" resume className="ml-3" />
      <ShellSearch className="order-last lg:order-none lg:ml-auto lg:w-80" />
      <LocaleSwitch className="ml-auto lg:ml-0" />
    </ShellHeader>
  );
}
