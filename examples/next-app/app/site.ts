import type { Metadata } from 'next';

let origin = process.env.SITE_URL || 'http://127.0.0.1:3100';
if (!process.env.SITE_URL && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  origin = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
}
export const siteOrigin = new URL(origin).origin;
export const indexable = process.env.VERCEL_ENV === 'production';
export const siteDescription =
  'A TypeScript library for React and Next.js that predicts cursor intent and prefetches routes before hover. Explore the live demo and documentation.';
export function siteUrl(path = '/') {
  return new URL(`${process.env.DEMO_BASE_PATH || ''}${path}`, siteOrigin).href;
}
export function pageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: siteUrl(path) },
    openGraph: {
      title: `${title} | next-intent`,
      description,
      url: siteUrl(path),
      siteName: 'next-intent',
      type: 'website',
      locale: 'en_US',
      images: [
        {
          url: siteUrl('/opengraph-image'),
          width: 1200,
          height: 630,
          alt: 'next-intent — A head start on your next click.',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | next-intent`,
      description,
      images: [siteUrl('/opengraph-image')],
    },
  };
}
