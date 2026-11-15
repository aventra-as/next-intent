import type {
  IntentPrediction,
  PredictionOptions,
  Rect,
} from './core/types.js';

export interface LinkTarget {
  element: HTMLAnchorElement;
  href: string;
  rect: Rect;
}

export interface IntentEvent {
  href: string;
  element: HTMLAnchorElement;
  reason: 'trajectory' | 'hover' | 'focus';
  prediction?: IntentPrediction<LinkTarget>;
}

export interface PrefetchContext {
  onInvalidate: () => void;
}

export type Prefetch = (
  href: string,
  context: PrefetchContext,
) => void | Promise<unknown>;

export interface IntentOptions extends PredictionOptions {
  enabled?: boolean;
  /** Restrict discovery to this subtree. Defaults to document. */
  root?: Document | HTMLElement;
  /** Mouse hover fallback. Default: true. */
  hover?: boolean;
  /** Keyboard focus fallback. Default: true. */
  focus?: boolean;
  /** Skip speculation on Save-Data and slow-2g/2g connections. Default: true. */
  respectSaveData?: boolean;
  /** Stable-target delay. Conservative: 24ms; balanced/aggressive: 0ms. */
  minIntentMs?: number;
  /** Suppress repeat requests for this long unless invalidated. Default: 30,000ms. */
  cooldownMs?: number;
  /** Request attempts per rolling window. Conservative: 3; balanced: 6; aggressive: 12. */
  maxPrefetches?: number;
  /** Rolling request budget window. Default: 10,000ms. */
  budgetWindowMs?: number;
  /** Maximum deduplication entries kept in memory. Default: 256. */
  maxEntries?: number;
  filter?: (href: string, element: HTMLAnchorElement) => boolean;
  onIntent?: (event: IntentEvent) => void;
  onError?: (error: unknown, event: IntentEvent) => void;
}

export interface IntentObserver {
  /** Replace options without replacing event listeners or request history. Root is fixed. */
  update: (options: Omit<IntentOptions, 'root'>) => void;
  /** Permit a route to be prefetched again on a future intent. */
  invalidate: (href?: string) => void;
  destroy: () => void;
}
