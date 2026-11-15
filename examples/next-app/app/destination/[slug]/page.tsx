import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata = { robots: { index: false, follow: true } };

const names: Record<string, string> = {
  atlas: 'Atlas',
  studio: 'Studio',
  archive: 'Archive',
};

export function generateStaticParams() {
  return Object.keys(names).map((slug) => ({ slug }));
}

export default async function Destination({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const name = names[slug];
  if (!name) notFound();
  return (
    <main className="destination">
      <Link href="/" prefetch={false}>
        ← Back to the playground
      </Link>
      <h1>{name}</h1>
      <p>
        You arrived. This is a real Next.js route served by the example
        application.
      </p>
    </main>
  );
}
