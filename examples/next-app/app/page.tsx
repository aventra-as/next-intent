import Playground from './playground';
import { pageMetadata, siteDescription, siteUrl } from './site';
import { StructuredData } from './structured-data';

export const metadata = pageMetadata(
  'Predictive prefetching for Next.js',
  siteDescription,
  '/',
);
export default function Home() {
  return (
    <>
      <StructuredData
        value={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareSourceCode',
          name: 'next-intent',
          description: siteDescription,
          url: siteUrl(),
          programmingLanguage: 'TypeScript',
          runtimePlatform: ['React', 'Next.js'],
          version: '0.1.0',
          license: 'https://opensource.org/licenses/MIT',
          downloadUrl: 'https://www.npmjs.com/package/next-intent',
          author: {
            '@type': 'Organization',
            name: 'Aventra AS',
            url: 'https://aventra.no',
          },
        }}
      />
      <Playground />
    </>
  );
}
