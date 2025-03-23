import './global.css';

import { lora } from './fonts';
import LiffProvider from './LiffProvider';

export const metadata = {
  title: "Hello! I'm Rainforest Cheng",
  description:
    'As a senior frontend engineer based in Tainan, Taiwan, I am actively seeking new employment opportunities or collaborative projects. My expertise lies in the development of applications utilizing React and Vue.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={lora.className}>
      <body>
        <LiffProvider liffId={process.env.LIFF_ID!}>{children}</LiffProvider>
      </body>
    </html>
  );
}
