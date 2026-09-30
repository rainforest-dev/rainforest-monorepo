import { type ReactNode, Suspense } from 'react';

import { LibraryProvider } from '@/components/library/LibraryProvider';
import { LibraryShell } from '@/components/library/LibraryShell';
import { readPrefs } from '@/lib/prefs-server';

interface Props {
  children: ReactNode;
  filters: ReactNode;
  pane: ReactNode;
}

export default function LibraryLayout(props: Props) {
  return (
    <Suspense fallback={<div className="bg-background h-14 border-b" />}>
      <LibraryRoot {...props} />
    </Suspense>
  );
}

async function LibraryRoot({ children, filters, pane }: Props) {
  const prefs = await readPrefs();
  return (
    <LibraryProvider initialPrefs={prefs}>
      <LibraryShell filters={filters} pane={pane}>
        {children}
      </LibraryShell>
    </LibraryProvider>
  );
}
