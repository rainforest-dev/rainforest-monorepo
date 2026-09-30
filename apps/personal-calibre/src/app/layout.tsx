import './globals.css';

import { Toaster } from '@rainforest-dev/rainforest-react';
import { Inter } from 'next/font/google';

import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

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
    <html lang="en" className={cn('font-sans', inter.variable)}>
      <body className="bg-background text-foreground min-h-screen">
        {children}
        <Toaster richColors position="bottom-center" />
      </body>
    </html>
  );
}
