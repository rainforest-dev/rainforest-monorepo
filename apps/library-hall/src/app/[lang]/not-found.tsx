import {
  LibraryBar,
  LibraryNotFound,
  ShellLayout,
} from '@rainforest-dev/library-shell';

export default function NotFound() {
  return (
    <ShellLayout
      mode="page"
      isDesktop={false}
      header={<LibraryBar current="hall" />}
    >
      <LibraryNotFound current="hall" />
    </ShellLayout>
  );
}
