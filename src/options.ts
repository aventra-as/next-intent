import { resolvePredictionOptions } from './core/predict.js';
import type { IntentOptions } from './types.js';

export function resolveOptions(options: IntentOptions = {}) {
  const prediction = resolvePredictionOptions(options);
  const config = {
    ...options,
    ...prediction,
    enabled: options.enabled ?? true,
    hover: options.hover ?? true,
    focus: options.focus ?? true,
    respectSaveData: options.respectSaveData ?? true,
    minIntentMs: options.minIntentMs ?? (prediction.mode === 'smart' ? 24 : 0),
    cooldownMs: options.cooldownMs ?? 30_000,
    maxPrefetches: options.maxPrefetches ?? 6,
    budgetWindowMs: options.budgetWindowMs ?? 10_000,
    maxEntries: options.maxEntries ?? 256,
  };
  for (const key of [
    'minIntentMs',
    'cooldownMs',
    'maxPrefetches',
    'budgetWindowMs',
    'maxEntries',
  ] as const) {
    if (!Number.isFinite(config[key]) || config[key] < 0)
      throw new RangeError(`${key} must be finite and nonnegative`);
  }
  for (const key of ['maxPrefetches', 'maxEntries'] as const) {
    if (!Number.isInteger(config[key]))
      throw new RangeError(`${key} must be an integer`);
  }
  if (config.budgetWindowMs === 0 || config.maxEntries === 0)
    throw new RangeError(
      'budgetWindowMs and maxEntries must be greater than zero',
    );
  return config;
}

export type ResolvedOptions = ReturnType<typeof resolveOptions>;
