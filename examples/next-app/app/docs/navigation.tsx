'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  ['/docs', 'Getting started'],
  ['/docs/modes', 'Prediction & modes'],
  ['/docs/configuration', 'Configuration'],
  ['/docs/api', 'API reference'],
  ['/docs/recipes', 'Recipes & troubleshooting'],
] as const;
export function DocsNavigation() {
  const pathname = usePathname();
  return (
    <nav className="docs-nav" aria-label="Documentation">
      {items.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? 'page' : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
