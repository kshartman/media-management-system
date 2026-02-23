import './globals.css';
import { DM_Sans } from 'next/font/google';
import { Providers } from './providers';
import { brandConfig } from '@/config';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:3000'),
  title: brandConfig.appTitle,
  description: brandConfig.appDescription,
  openGraph: {
    title: brandConfig.appTitle,
    description: brandConfig.appDescription,
    ...(brandConfig.logoPath ? { images: [brandConfig.logoPath] } : {}),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={dmSans.className}>
      <head>
        <link rel="icon" href={brandConfig.faviconPath} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}