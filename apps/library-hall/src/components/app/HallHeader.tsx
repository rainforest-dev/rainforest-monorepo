import {
  COLLECTION_ICONS,
  CollectionNav,
  ShellHeader,
} from '@rainforest-dev/library-shell';

const HallIcon = COLLECTION_ICONS.hall;

/** The shared top bar, as the hall shows it: the library's name and the collection switcher. */
export function HallHeader() {
  return (
    <ShellHeader>
      <a
        href="/"
        className="flex items-center gap-2 font-semibold tracking-tight"
      >
        <HallIcon className="text-primary size-5" aria-hidden />
        Rainforest 圖書館
      </a>
      <CollectionNav current="hall" resume className="ml-3" />
    </ShellHeader>
  );
}
