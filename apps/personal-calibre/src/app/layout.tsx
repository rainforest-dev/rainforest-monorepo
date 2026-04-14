import './globals.css';

import { Geist } from 'next/font/google';

import { cn } from '@/lib/utils';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

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
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <body className="bg-background text-foreground min-h-screen">
        {children}
      </body>
    </html>
  );
}
