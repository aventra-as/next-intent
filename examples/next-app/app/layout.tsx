import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './style.css';
import { SiteHeader } from './site-header';

export const metadata: Metadata = {
  title: {
    default: 'next-intent — Cursor intent for Next.js',
    template: '%s | next-intent',
  },
  description:
    'Predict cursor intent and prefetch Next.js routes before hover. Explore the playground and learn how to add next-intent to your app.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
