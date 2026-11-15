import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './style.css';

export const metadata: Metadata = {
  title: 'next-intent playground',
  description: 'Try cursor-based route prefetching in Next.js.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
