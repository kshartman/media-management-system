import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'Affiliate Resources',
  description: 'A system for managing and browsing digital media assets',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}