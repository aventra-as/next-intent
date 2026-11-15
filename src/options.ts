import { resolvePredictionOptions } from './core/predict.js';
import type { IntentOptions } from './types.js';

const requestPresets = {
  conservative: { minIntentMs: 24, maxPrefetches: 3 },
  balanced: { minIntentMs: 0, maxPrefetches: 6 },
  aggressive: { minIntentMs: 0, maxPrefetches: 12 },
};

export function resolveOptions(options: IntentOptions = {}) {
  const prediction = resolvePredictionOptions(options);
  const preset = requestPresets[prediction.mode];
  const config = {
    ...options,
    ...prediction,
    enabled: options.enabled ?? true,
    hover: options.hover ?? true,
    focus: options.focus ?? true,
    respectSaveData: options.respectSaveData ?? true,
    minIntentMs: options.minIntentMs ?? preset.minIntentMs,
    cooldownMs: options.cooldownMs ?? 30_000,
    maxPrefetches: options.maxPrefetches ?? preset.maxPrefetches,
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
