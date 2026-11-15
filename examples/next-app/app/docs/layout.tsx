import type { ReactNode } from 'react';
import { DocsNavigation } from './navigation';
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <main className="docs-layout">
      <aside>
        <DocsNavigation />
      </aside>
      <article className="docs-article">{children}</article>
    </main>
  );
}
