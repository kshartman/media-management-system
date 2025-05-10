import './globals.css';

export const metadata = {
  title: 'Media Management System',
  description: 'A system for managing and browsing digital media assets',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}