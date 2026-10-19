import './globals.css';

import { ShellHead } from '@rainforest-dev/library-shell';
import { Toaster } from '@rainforest-dev/rainforest-react';

export const metadata = {
  title: 'Personal Calibre Library',
  description: 'Browse your Calibre ebook library',
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
        {children}
        <Toaster richColors position="bottom-center" />
      </body>
    </html>
  );
}
