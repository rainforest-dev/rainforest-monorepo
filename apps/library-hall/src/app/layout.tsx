import './globals.css';

import { ShellHead } from '@rainforest-dev/library-shell';
import { Toaster } from '@rainforest-dev/rainforest-react';

export const metadata = {
  title: 'Rainforest 圖書館',
  description: '走進書櫃之間，瀏覽每個館藏',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant" className="font-sans">
      <body className="bg-background text-foreground min-h-screen">
        <ShellHead />
        {children}
        <Toaster richColors position="bottom-center" />
      </body>
    </html>
  );
}
