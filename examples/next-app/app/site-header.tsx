import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" prefetch={false}>
        next-intent
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/" prefetch={false}>
          Playground
        </Link>
        <Link href="/docs">Docs</Link>
        <a href="https://www.npmjs.com/package/next-intent">npm ↗</a>
        <a href="https://github.com/aventra-as/next-intent">GitHub ↗</a>
      </nav>
    </header>
  );
}
