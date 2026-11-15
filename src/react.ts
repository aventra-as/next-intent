'use client';

import { useEffect, useRef } from 'react';
import { createIntentObserver } from './browser.js';
import type { IntentObserver, IntentOptions, Prefetch } from './types.js';

export type {
  IntentOptions,
  IntentEvent,
  Prefetch,
  PrefetchContext,
} from './types.js';

/** Router-independent adapter. Mount once per observed root. */
export function useIntent(
  prefetch: Prefetch,
  options: IntentOptions = {},
): void {
  const observer = useRef<IntentObserver | undefined>(undefined);
  const committed = useRef({ prefetch, options });
  const root = options.root;
  // Update after commit so abandoned concurrent renders cannot change live listeners.
  useEffect(() => {
    committed.current = { prefetch, options };
    observer.current?.update(options);
  });
  useEffect(() => {
    const instance = createIntentObserver(
      (href, context) => committed.current.prefetch(href, context),
      committed.current.options,
    );
    observer.current = instance;
    return () => {
      instance.destroy();
      observer.current = undefined;
    };
  }, [root]);
}
