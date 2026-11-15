import type { MetadataRoute } from 'next';
import { siteUrl } from './site';
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    '/',
    '/docs',
    '/docs/modes',
    '/docs/configuration',
    '/docs/api',
    '/docs/recipes',
  ].map((path) => ({ url: siteUrl(path) }));
}
