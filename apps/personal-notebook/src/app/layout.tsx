import './globals.css';

import { ShellHead } from '@rainforest-dev/library-shell';
import { Toaster } from '@rainforest-dev/rainforest-react';

import { NotebookShell } from '@/components/shell';

export const metadata = {
  title: 'Notebooks',
  description: 'Scanned pages of paper Bullet Journals',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="font-sans">
      <body className="bg-background text-foreground min-h-screen">
        <ShellHead />
        <NotebookShell>{children}</NotebookShell>
        <Toaster richColors position="bottom-center" />
      </body>
    </html>
  );
}
