'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ForwardRefExoticComponent,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react';
import { useIntent } from './react.js';
import type { IntentOptions } from './types.js';

export type {
  IntentOptions,
  IntentEvent,
  PredictionFrame,
  Prefetch,
  PrefetchContext,
} from './types.js';
export type { PredictionMode, IntentPrediction } from './core/types.js';

export function useNextIntent(options: IntentOptions = {}): void {
  const router = useRouter();
  useIntent((href, context) => {
    // DOM hrefs already contain basePath. Absolute URLs avoid adding it twice.
    const url = new URL(href, window.location.origin).href;
    router.prefetch(url, {
      ...context,
      kind: 'full' as NonNullable<
        Parameters<typeof router.prefetch>[1]
      >['kind'],
    });
  }, options);
}

export interface NextIntentProps extends IntentOptions {
  children?: ReactNode;
}

/** Mount once in your App Router layout. Wrapping children is optional. */
export function NextIntent({
  children,
  ...options
}: NextIntentProps): ReactElement {
  useNextIntent(options);
  return <>{children}</>;
}

export type IntentLinkProps = ComponentPropsWithoutRef<typeof Link>;

/** Next.js Link with viewport prefetch disabled by default. */
export const IntentLink: ForwardRefExoticComponent<
  IntentLinkProps & RefAttributes<HTMLAnchorElement>
> = forwardRef<HTMLAnchorElement, IntentLinkProps>(function IntentLink(
  { prefetch = false, ...props },
  ref,
) {
  return <Link {...props} prefetch={prefetch} ref={ref} />;
});
