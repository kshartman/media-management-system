import './globals.css';
import { Providers } from './providers';
import { brandConfig } from '@/config';

export const metadata = {
  title: brandConfig.appTitle,
  description: brandConfig.appDescription,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href={brandConfig.faviconPath} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}