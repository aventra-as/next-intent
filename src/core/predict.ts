import type {
  IntentPrediction,
  IntentTarget,
  Point,
  PointerSample,
  PredictionOptions,
  Rect,
} from './types.js';

export const predictionPresets = Object.freeze({
  conservative: Object.freeze({
    horizonMs: 120,
    minSpeed: 0.1,
    padding: 2,
    threshold: 0.8,
  }),
  balanced: Object.freeze({
    horizonMs: 200,
    minSpeed: 0.08,
    padding: 8,
    threshold: 0.6,
  }),
  aggressive: Object.freeze({
    horizonMs: 350,
    minSpeed: 0.05,
    padding: 16,
    threshold: 0.4,
  }),
});

export const predictionDefaults = Object.freeze({
  mode: 'balanced' as const,
  ...predictionPresets.balanced,
});

export function resolvePredictionOptions(
  options: PredictionOptions = {},
): Required<PredictionOptions> {
  const mode = options.mode ?? predictionDefaults.mode;
  if (mode !== 'conservative' && mode !== 'balanced' && mode !== 'aggressive')
    throw new RangeError('mode must be conservative, balanced, or aggressive');
  const config = { ...predictionPresets[mode], ...options, mode };
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

interface MotionEstimate {
  origin: Point;
  velocity: Point;
  stability: number;
}

/** Shared motion estimate for target selection and live visualization. */
export function estimateMotion(
  samples: readonly PointerSample[],
  config: Required<PredictionOptions>,
): MotionEstimate | null {
  const recent = samples.slice(-12);
  if (recent.length < 2) return null;
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
    const speed = Math.hypot(x, y);
    if (!Number.isFinite(speed)) return null;
    segments.push({ x, y, speed, dt });
  }
  const latest = segments.at(-1)!;
  if (latest.speed < config.minSpeed || latest.speed === 0) return null;
  let sumX = 0;
  let sumY = 0;
  let sumSpeed = 0;
  let weights = 0;
  let ageMs = 0;
  let included = 0;
  let sharpTurn = false;
  // Weight elapsed time, not event count: mouse polling rates and frame timing vary.
  for (let i = segments.length - 1; i >= 0 && ageMs < 64; i--) {
    const segment = segments[i]!;
    if (segment.speed === 0) break;
    const alignment =
      (segment.x * latest.x + segment.y * latest.y) /
      (segment.speed * latest.speed);
    if (alignment < 0.5) {
      sharpTurn = true;
      break;
    }
    const weight = segment.dt * Math.exp(-ageMs / 24);
    sumX += segment.x * weight;
    sumY += segment.y * weight;
    sumSpeed += segment.speed * weight;
    weights += weight;
    ageMs += segment.dt;
    included++;
  }
  const magnitude = Math.hypot(sumX, sumY);
  if (!Number.isFinite(magnitude) || magnitude === 0) return null;
  let stability = Math.min(1, magnitude / sumSpeed);
  if (sharpTurn && included === 1) stability *= 0.5;
  const last = recent.at(-1)!;
  return {
    origin: { x: last.x, y: last.y },
    velocity: { x: sumX / weights, y: sumY / weights },
    stability,
  };
}

export function selectTarget<T extends IntentTarget>(
  motion: MotionEstimate | null,
  targets: readonly T[],
  config: Required<PredictionOptions>,
): IntentPrediction<T> | null {
  if (!motion) return null;
  const { origin, velocity, stability } = motion;
  const speed = Math.hypot(velocity.x, velocity.y);
  const direction = { x: velocity.x / speed, y: velocity.y / speed };
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
    // Do not treat a single speed dip as a physical stop: hand motion is not ballistic.
    const timeToTarget = distance / speed;
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
      velocity: { ...velocity },
    };
  }
  return winner;
}

/** Pure trajectory prediction. Target objects are returned unchanged. */
export function predictIntent<T extends IntentTarget>(
  samples: readonly PointerSample[],
  targets: readonly T[],
  options: PredictionOptions = {},
): IntentPrediction<T> | null {
  const config = resolvePredictionOptions(options);
  return selectTarget(estimateMotion(samples, config), targets, config);
}
