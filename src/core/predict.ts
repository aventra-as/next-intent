import type {
  IntentPrediction,
  IntentTarget,
  Point,
  PointerSample,
  PredictionOptions,
  Rect,
} from './types.js';

export const predictionDefaults = Object.freeze({
  mode: 'smart' as const,
  horizonMs: 200,
  minSpeed: 0.08,
  padding: 8,
  threshold: 0.6,
});

export function resolvePredictionOptions(
  options: PredictionOptions = {},
): Required<PredictionOptions> {
  const config = { ...predictionDefaults, ...options };
  if (config.mode !== 'simple' && config.mode !== 'smart')
    throw new RangeError('mode must be simple or smart');
  for (const key of [
    'horizonMs',
    'minSpeed',
    'padding',
    'threshold',
  ] as const) {
    if (!Number.isFinite(config[key]) || config[key] < 0)
      throw new RangeError(`${key} must be finite and nonnegative`);
  }
  if (config.horizonMs === 0)
    throw new RangeError('horizonMs must be greater than zero');
  if (config.threshold > 1) throw new RangeError('threshold must be at most 1');
  return config;
}

function inside(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}

/** Slab intersection, expressed as distance along a normalized ray. */
function intersect(
  origin: Point,
  direction: Point,
  rect: Rect,
  padding: number,
): number | null {
  let near = 0;
  let far = Infinity;
  for (const [position, velocity, low, high] of [
    [origin.x, direction.x, rect.left - padding, rect.right + padding],
    [origin.y, direction.y, rect.top - padding, rect.bottom + padding],
  ] as const) {
    if (Math.abs(velocity) < 1e-10) {
      if (position < low || position > high) return null;
      continue;
    }
    const a = (low - position) / velocity;
    const b = (high - position) / velocity;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return null;
  }
  if (far < 0) return null;
  return near;
}

/** Pure trajectory prediction. Target objects are returned unchanged. */
export function predictIntent<T extends IntentTarget>(
  samples: readonly PointerSample[],
  targets: readonly T[],
  options: PredictionOptions = {},
): IntentPrediction<T> | null {
  const config = resolvePredictionOptions(options);
  const minimum = config.mode === 'smart' ? 3 : 2;
  const recent = samples.slice(-6);
  if (recent.length < minimum || targets.length === 0) return null;
  const segments: { x: number; y: number; speed: number; dt: number }[] = [];
  for (let i = 0; i < recent.length; i++) {
    const sample = recent[i]!;
    if (![sample.x, sample.y, sample.time].every(Number.isFinite)) return null;
    if (i === 0) continue;
    const previous = recent[i - 1]!;
    const dt = sample.time - previous.time;
    if (dt <= 0 || dt > 150) return null;
    const x = (sample.x - previous.x) / dt;
    const y = (sample.y - previous.y) / dt;
    segments.push({ x, y, speed: Math.hypot(x, y), dt });
  }
  const latest = segments.at(-1)!;
  if (latest.speed < config.minSpeed || latest.speed === 0) return null;
  let velocity: Point = { x: latest.x, y: latest.y };
  let stability = 1;
  let deceleration = 0;
  if (config.mode === 'smart') {
    let sumX = 0;
    let sumY = 0;
    let sumSpeed = 0;
    let weights = 0;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      const weight = (i + 1) ** 2;
      sumX += segment.x * weight;
      sumY += segment.y * weight;
      sumSpeed += segment.speed * weight;
      weights += weight;
    }
    const magnitude = Math.hypot(sumX, sumY);
    if (magnitude === 0 || sumSpeed === 0) return null;
    const alignment = Math.max(
      0,
      (sumX * latest.x + sumY * latest.y) / (magnitude * latest.speed),
    );
    stability = (magnitude / sumSpeed) * alignment;
    velocity = { x: sumX / weights, y: sumY / weights };
    const previous = segments.at(-2)!;
    deceleration = Math.max(
      0,
      (previous.speed - latest.speed) / ((previous.dt + latest.dt) / 2),
    );
  }
  // Use the current speed for arrival estimates, even when smoothing direction.
  const magnitude = Math.hypot(velocity.x, velocity.y);
  if (magnitude === 0) return null;
  const direction = { x: velocity.x / magnitude, y: velocity.y / magnitude };
  const origin = recent.at(-1)!;
  let winner: IntentPrediction<T> | null = null;
  for (const target of targets) {
    const rect = target.rect;
    if (![rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite))
      continue;
    if (
      rect.right <= rect.left ||
      rect.bottom <= rect.top ||
      inside(origin, rect)
    )
      continue;
    const distance = intersect(origin, direction, rect, config.padding);
    if (distance === null) continue;
    let timeToTarget = distance / latest.speed;
    if (deceleration > 1e-8) {
      const discriminant = latest.speed ** 2 - 2 * deceleration * distance;
      if (discriminant < 0) continue;
      // Rationalized quadratic root avoids cancellation for small distances.
      timeToTarget = (2 * distance) / (latest.speed + Math.sqrt(discriminant));
    }
    if (timeToTarget > config.horizonMs) continue;
    const confidence = Math.min(
      1,
      stability * (1 - (0.25 * timeToTarget) / config.horizonMs),
    );
    if (confidence < config.threshold) continue;
    if (winner && winner.timeToTarget <= timeToTarget) continue;
    winner = {
      target,
      confidence,
      timeToTarget,
      point: {
        x: Math.max(
          rect.left,
          Math.min(rect.right, origin.x + direction.x * distance),
        ),
        y: Math.max(
          rect.top,
          Math.min(rect.bottom, origin.y + direction.y * distance),
        ),
      },
      velocity: {
        x: direction.x * latest.speed,
        y: direction.y * latest.speed,
      },
    };
  }
  return winner;
}
