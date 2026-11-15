import { notFound } from 'next/navigation';
import { docs, DocContent } from '../content';
import { pageMetadata } from '../../site';
export function generateStaticParams() {
  return Object.keys(docs)
    .filter((slug) => slug !== 'start')
    .map((slug) => ({ slug }));
}
export const dynamicParams = false;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = docs[slug];
  if (!doc || slug === 'start') notFound();
  return pageMetadata(doc.title, doc.description, `/docs/${slug}`);
}
export default async function Documentation({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = docs[slug];
  if (!doc || slug === 'start') notFound();
  return <DocContent doc={doc} path={`/docs/${slug}`} />;
}
