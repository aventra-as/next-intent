import type { ResolvedOptions } from './options.js';
import type { IntentEvent, Prefetch } from './types.js';

export class PrefetchScheduler {
  private entries = new Map<string, { expires: number; token: object }>();
  private attempts: number[] = [];
  private destroyed = false;

  constructor(
    private prefetch: Prefetch,
    private now: () => number,
  ) {}

  invalidate(href?: string): void {
    if (href === undefined) this.entries.clear();
    else this.entries.delete(href);
  }

  destroy(): void {
    this.destroyed = true;
    this.entries.clear();
    this.attempts = [];
  }

  request(event: IntentEvent, config: ResolvedOptions): boolean {
    if (this.destroyed) return false;
    const now = this.now();
    for (const [href, entry] of this.entries) {
      if (entry.expires <= now) this.entries.delete(href);
    }
    this.attempts = this.attempts.filter(
      (time) => now - time < config.budgetWindowMs,
    );
    if (
      this.entries.has(event.href) ||
      this.attempts.length >= config.maxPrefetches
    )
      return false;
    while (this.entries.size >= config.maxEntries)
      this.entries.delete(this.entries.keys().next().value!);
    const token = {};
    this.entries.set(event.href, { expires: now + config.cooldownMs, token });
    this.attempts.push(now);
    const invalidate = () => {
      if (this.entries.get(event.href)?.token === token)
        this.entries.delete(event.href);
    };
    const report = (error: unknown) => {
      if (this.destroyed) return;
      try {
        config.onError?.(error, event);
      } catch {
        /* A diagnostic callback must not break input handling. */
      }
    };
    try {
      const result = this.prefetch(event.href, { onInvalidate: invalidate });
      if (result)
        void Promise.resolve(result).catch((error: unknown) => {
          invalidate();
          report(error);
        });
    } catch (error) {
      invalidate();
      report(error);
      return false;
    }
    try {
      config.onIntent?.(event);
    } catch (error) {
      report(error);
    }
    return true;
  }
}
