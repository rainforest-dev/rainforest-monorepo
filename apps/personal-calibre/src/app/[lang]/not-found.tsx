import {
  LibraryBar,
  LibraryNotFound,
  ShellLayout,
} from '@rainforest-dev/library-shell';

/** Outside the catalogue's own layout, so a missing book does not need its filters to load. */
export default function NotFound() {
  return (
    <ShellLayout
      mode="page"
      isDesktop={false}
      header={<LibraryBar current="books" />}
    >
      <LibraryNotFound current="books" />
    </ShellLayout>
  );
}
