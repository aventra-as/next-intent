import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './style.css';
import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';
import { siteOrigin, siteDescription, indexable } from './site';

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  applicationName: 'next-intent',
  robots: { index: indexable, follow: true },
  title: {
    default: 'next-intent — Cursor intent for Next.js',
    template: '%s | next-intent',
  },
  description: siteDescription,
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
