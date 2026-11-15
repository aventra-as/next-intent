'use client';

import { useRouter } from 'next/router';
import type { ReactElement, ReactNode } from 'react';
import { useIntent } from './react.js';
import type { IntentOptions } from './types.js';
import { stripBasePath } from './links.js';

export type { IntentOptions, IntentEvent } from './types.js';

export function useNextIntent(options: IntentOptions = {}): void {
  const router = useRouter();
  useIntent(
    (href) =>
      router.prefetch(stripBasePath(href, router.basePath), undefined, {
        locale: false,
      }),
    options,
  );
}

export function NextIntent({
  children,
  ...options
}: IntentOptions & { children?: ReactNode }): ReactElement {
  useNextIntent(options);
  return <>{children}</>;
}
