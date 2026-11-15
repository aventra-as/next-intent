export interface Point {
  x: number;
  y: number;
}

/** Coordinates in CSS pixels; time in milliseconds from a monotonic clock. */
export interface PointerSample extends Point {
  time: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface IntentTarget {
  rect: Rect;
}

export type PredictionMode = 'conservative' | 'balanced' | 'aggressive';

export interface PredictionOptions {
  /** Prefetch aggressiveness. Default: balanced. Explicit options override the preset. */
  mode?: PredictionMode;
  /** Maximum look-ahead in milliseconds. Default: 200. */
  horizonMs?: number;
  /** Minimum cursor speed in CSS pixels per millisecond. Default: 0.08. */
  minSpeed?: number;
  /** Extra target area in CSS pixels. Default: 8. */
  padding?: number;
  /** Minimum heuristic score, from 0 to 1. Default: 0.6. */
  threshold?: number;
}

export interface IntentPrediction<T extends IntentTarget = IntentTarget> {
  target: T;
  /** Heuristic score, not a calibrated probability. */
  confidence: number;
  /** Estimated milliseconds until the pointer reaches the padded target. */
  timeToTarget: number;
  point: Point;
  velocity: Point;
}
