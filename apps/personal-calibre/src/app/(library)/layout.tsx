import Link from 'next/link';

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border bg-card sticky top-0 z-10 border-b px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Library
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
