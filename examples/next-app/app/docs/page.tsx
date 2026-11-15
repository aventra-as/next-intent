import { docs, DocContent } from './content';
import { pageMetadata } from '../site';
export const metadata = pageMetadata(
  'Getting started with Next.js',
  docs.start!.description,
  '/docs',
);
export default function GettingStarted() {
  return <DocContent doc={docs.start!} path="/docs" />;
}
