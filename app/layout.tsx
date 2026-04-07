import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Video Template Builder',
  description: 'Visual blueprint builder for automated video content engine',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="overflow-hidden h-screen">{children}</body>
    </html>
  );
}
