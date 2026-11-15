import { describe, expect, it, vi } from 'vitest';
import { PrefetchScheduler } from '../src/scheduler.js';
import { resolveOptions } from '../src/options.js';
import type {
  IntentEvent,
  IntentOptions,
  PrefetchContext,
} from '../src/types.js';

const event = (href = '/a'): IntentEvent => ({
  href,
  element: document.createElement('a'),
  reason: 'trajectory',
});
function setup(options: IntentOptions = {}) {
  let now = 0;
  const prefetch = vi.fn();
  const config = resolveOptions(options);
  const scheduler = new PrefetchScheduler(prefetch, () => now);
  return {
    prefetch,
    scheduler,
    config,
    advance: (ms: number) => {
      now += ms;
    },
    request: (href?: string) => scheduler.request(event(href), config),
  };
}

describe('request scheduling', () => {
  it('prefetches once per destination', () => {
    const s = setup();
    expect(s.request()).toBe(true);
    expect(s.request()).toBe(false);
    expect(s.prefetch).toHaveBeenCalledTimes(1);
  });
  it('expires a cached destination', () => {
    const s = setup({ cooldownMs: 100 });
    s.request();
    s.advance(100);
    expect(s.request()).toBe(true);
  });
  it('respects a rolling request budget', () => {
    const s = setup({ maxPrefetches: 2, budgetWindowMs: 100 });
    expect(s.request('/a')).toBe(true);
    s.advance(50);
    expect(s.request('/b')).toBe(true);
    expect(s.request('/c')).toBe(false);
    s.advance(50);
    expect(s.request('/c')).toBe(true);
    expect(s.request('/d')).toBe(false);
    s.advance(50);
    expect(s.request('/d')).toBe(true);
  });
  it('supports a zero request budget', () => {
    const s = setup({ maxPrefetches: 0 });
    expect(s.request()).toBe(false);
  });
  it('allows explicit route invalidation', () => {
    const s = setup();
    s.request();
    s.scheduler.invalidate('/a');
    expect(s.request()).toBe(true);
  });
  it('allows clearing all route entries', () => {
    const s = setup();
    s.request('/a');
    s.request('/b');
    s.scheduler.invalidate();
    expect(s.request('/a')).toBe(true);
    expect(s.request('/b')).toBe(true);
  });
  it('invalidates when the router marks cached data stale', () => {
    const s = setup();
    s.request();
    const context = s.prefetch.mock.calls[0]![1] as PrefetchContext;
    context.onInvalidate();
    expect(s.request()).toBe(true);
  });
  it('ignores an old invalidation callback after a new request', () => {
    const s = setup();
    s.request();
    const context = s.prefetch.mock.calls[0]![1] as PrefetchContext;
    s.scheduler.invalidate();
    s.request();
    context.onInvalidate();
    expect(s.request()).toBe(false);
  });
  it('evicts the oldest destination at its memory bound', () => {
    const s = setup({ maxEntries: 2 });
    s.request('/a');
    s.request('/b');
    s.request('/c');
    expect(s.request('/b')).toBe(false);
    expect(s.request('/a')).toBe(true);
  });
  it('calls diagnostics only when a request is accepted', () => {
    const onIntent = vi.fn();
    const s = setup({ onIntent });
    s.request();
    s.request();
    expect(onIntent).toHaveBeenCalledTimes(1);
    expect(onIntent.mock.calls[0]![0].reason).toBe('trajectory');
  });
  it('releases failures for retry but counts them against the budget', () => {
    const onError = vi.fn();
    const s = setup({ onError, maxPrefetches: 2 });
    s.prefetch.mockImplementation(() => {
      throw new Error('offline');
    });
    expect(s.request()).toBe(false);
    expect(s.request()).toBe(false);
    expect(s.request()).toBe(false);
    expect(s.prefetch).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(2);
  });
  it('handles rejected promises without an unhandled rejection', async () => {
    const onError = vi.fn();
    const s = setup({ onError });
    s.prefetch.mockRejectedValue(new Error('failed'));
    s.request();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledOnce();
    expect(s.request()).toBe(true);
    await Promise.resolve();
  });
  it('does not clear a newer entry when an old request rejects', async () => {
    let reject!: (reason: Error) => void;
    const s = setup();
    s.prefetch.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    s.request();
    s.scheduler.invalidate();
    s.request();
    reject(new Error('late'));
    await Promise.resolve();
    expect(s.request()).toBe(false);
  });
  it('isolates diagnostic callback failures', () => {
    const s = setup({
      onIntent: () => {
        throw new Error('intent');
      },
      onError: () => {
        throw new Error('error');
      },
    });
    expect(() => s.request()).not.toThrow();
    expect(s.prefetch).toHaveBeenCalledOnce();
  });
  it('stops after destruction', () => {
    const s = setup();
    s.scheduler.destroy();
    expect(s.request()).toBe(false);
  });
  it('suppresses async diagnostics after destruction', async () => {
    const onError = vi.fn();
    const s = setup({ onError });
    s.prefetch.mockRejectedValue(new Error('late'));
    s.request();
    s.scheduler.destroy();
    await Promise.resolve();
    expect(onError).not.toHaveBeenCalled();
  });
  it('supports promises that resolve', async () => {
    const s = setup();
    s.prefetch.mockResolvedValue(undefined);
    s.request();
    await Promise.resolve();
    expect(s.request()).toBe(false);
  });
});

describe('browser options', () => {
  it('defaults to balanced mode without an extra delay', () =>
    expect(resolveOptions().minIntentMs).toBe(0));
  it('balanced mode acts immediately by default', () =>
    expect(resolveOptions({ mode: 'balanced' }).minIntentMs).toBe(0));
  it.each([
    ['conservative', 24, 3],
    ['balanced', 0, 6],
    ['aggressive', 0, 12],
  ] as const)(
    'sets the %s request budget',
    (mode, minIntentMs, maxPrefetches) => {
      expect(resolveOptions({ mode })).toMatchObject({
        minIntentMs,
        maxPrefetches,
      });
    },
  );
  it('lets explicit configuration override a preset', () => {
    expect(
      resolveOptions({
        mode: 'conservative',
        minIntentMs: 0,
        maxPrefetches: 9,
        horizonMs: 400,
      }),
    ).toMatchObject({ minIntentMs: 0, maxPrefetches: 9, horizonMs: 400 });
  });
  it.each([
    'minIntentMs',
    'cooldownMs',
    'maxPrefetches',
    'budgetWindowMs',
    'maxEntries',
  ] as const)('rejects negative %s', (key) =>
    expect(() => resolveOptions({ [key]: -1 })).toThrow(),
  );
  it.each([
    { maxPrefetches: 1.5 },
    { maxEntries: 1.5 },
    { maxEntries: 0 },
    { budgetWindowMs: 0 },
    { cooldownMs: NaN },
  ])('rejects invalid %j', (options) =>
    expect(() => resolveOptions(options)).toThrow(),
  );
});
