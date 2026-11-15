import { docs, DocContent } from './content';
export const metadata = { title: 'Getting started' };
export default function GettingStarted() {
  return <DocContent doc={docs.start!} />;
}
