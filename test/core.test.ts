import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  predictIntent,
  predictionDefaults,
  predictionPresets,
} from '../src/core/index.js';
import type { PointerSample, PredictionOptions } from '../src/core/index.js';

const path = [
  { x: 0, y: 50, time: 0 },
  { x: 10, y: 50, time: 10 },
  { x: 20, y: 50, time: 20 },
];
const target = {
  id: 'a',
  rect: { left: 100, right: 140, top: 30, bottom: 70 },
};

describe('predictIntent', () => {
  it.each(['conservative', 'balanced', 'aggressive'] as const)(
    'predicts a target before hover in %s mode',
    (mode) => {
      const result = predictIntent(path, [target], { mode, padding: 0 });
      expect(result?.target).toBe(target);
      expect(result?.timeToTarget).toBe(80);
      expect(result?.velocity).toEqual({ x: 1, y: 0 });
      expect(result?.point).toEqual({ x: 100, y: 50 });
      expect(result?.confidence).toBeCloseTo(
        1 - (0.25 * 80) / predictionPresets[mode].horizonMs,
      );
    },
  );
  it('has immutable public defaults', () => {
    expect(Object.isFrozen(predictionDefaults)).toBe(true);
    expect(predictionDefaults.mode).toBe('balanced');
    expect(Object.isFrozen(predictionPresets.conservative)).toBe(true);
  });
  it.each([{ samples: [] }, { samples: path.slice(0, 1) }])(
    'requires two samples: $samples',
    ({ samples }) => {
      expect(predictIntent(samples, [target])).toBeNull();
    },
  );
  it('can predict after two samples', () =>
    expect(
      predictIntent(path.slice(-2), [target], { mode: 'balanced' }),
    ).not.toBeNull());
  it('returns null without targets', () =>
    expect(predictIntent(path, [])).toBeNull());
  it('chooses the first target reached, independently of array order', () => {
    const far = { rect: { ...target.rect, left: 200, right: 240 } };
    expect(predictIntent(path, [far, target])?.target).toBe(target);
    expect(predictIntent(path, [target, far])?.target).toBe(target);
  });
  it('breaks arrival ties by input order', () => {
    const other = { ...target, id: 'b' };
    expect(predictIntent(path, [other, target])?.target).toBe(other);
  });
  it.each([
    ['behind', { left: -100, right: -50, top: 30, bottom: 70 }],
    ['above', { left: 100, right: 140, top: -100, bottom: -50 }],
    ['below', { left: 100, right: 140, top: 100, bottom: 150 }],
    ['beyond horizon', { left: 1000, right: 1050, top: 30, bottom: 70 }],
    ['zero width', { left: 100, right: 100, top: 30, bottom: 70 }],
    ['zero height', { left: 100, right: 140, top: 30, bottom: 30 }],
    ['inverted', { left: 140, right: 100, top: 30, bottom: 70 }],
    ['NaN', { left: NaN, right: 140, top: 30, bottom: 70 }],
    ['infinite', { left: 100, right: Infinity, top: 30, bottom: 70 }],
    ['already hovered', { left: 10, right: 100, top: 30, bottom: 70 }],
  ])('ignores a target %s', (_, rect) =>
    expect(predictIntent(path, [{ rect }])).toBeNull(),
  );
  it.each([
    [
      'left',
      [
        { x: 200, y: 50, time: 0 },
        { x: 190, y: 50, time: 10 },
        { x: 180, y: 50, time: 20 },
      ],
    ],
    [
      'down',
      [
        { x: 120, y: -50, time: 0 },
        { x: 120, y: -40, time: 10 },
        { x: 120, y: -30, time: 20 },
      ],
    ],
    [
      'up',
      [
        { x: 120, y: 150, time: 0 },
        { x: 120, y: 140, time: 10 },
        { x: 120, y: 130, time: 20 },
      ],
    ],
    [
      'diagonal',
      [
        { x: 0, y: -70, time: 0 },
        { x: 10, y: -60, time: 10 },
        { x: 20, y: -50, time: 20 },
      ],
    ],
  ])('handles movement %s', (_, samples) =>
    expect(predictIntent(samples, [target])).not.toBeNull(),
  );
  it('rejects a diagonal ray whose axis intervals do not overlap', () => {
    const samples = path.map((sample) => ({ ...sample, y: sample.x }));
    expect(predictIntent(samples, [target], { padding: 0 })).toBeNull();
  });
  it('allows a near miss within padding', () => {
    const samples = path.map((sample) => ({ ...sample, y: 25 }));
    expect(predictIntent(samples, [target], { padding: 0 })).toBeNull();
    expect(predictIntent(samples, [target], { padding: 8 })?.point.y).toBe(30);
  });
  it('predicts immediate arrival inside the padded region', () => {
    const samples = path.map((sample) => ({ ...sample, x: sample.x + 75 }));
    expect(predictIntent(samples, [target])?.timeToTarget).toBe(0);
  });
  it('honors the horizon boundary', () => {
    expect(
      predictIntent(path, [target], { padding: 0, horizonMs: 80 }),
    ).not.toBeNull();
    expect(
      predictIntent(path, [target], { padding: 0, horizonMs: 79 }),
    ).toBeNull();
  });
  it('honors confidence threshold', () =>
    expect(predictIntent(path, [target], { threshold: 1 })).toBeNull());
  it('rejects a stationary cursor', () =>
    expect(
      predictIntent(
        path.map((s) => ({ ...s, x: 0 })),
        [target],
        { minSpeed: 0 },
      ),
    ).toBeNull());
  it('rejects slow movement', () =>
    expect(
      predictIntent(
        path.map((s) => ({ ...s, x: s.x / 100 })),
        [target],
      ),
    ).toBeNull());
  it.each(['x', 'y', 'time'] as const)(
    'rejects nonfinite %s samples',
    (key) => {
      expect(
        predictIntent(
          [{ ...path[0]!, [key]: NaN }, ...path.slice(1)],
          [target],
        ),
      ).toBeNull();
    },
  );
  it.each([0, -10, 151])('rejects invalid sample intervals: %s', (dt) => {
    expect(
      predictIntent(
        [
          { x: 0, y: 50, time: 0 },
          { x: 10, y: 50, time: dt },
        ],
        [target],
        { mode: 'balanced' },
      ),
    ).toBeNull();
  });
  it('waits for a consistent direction after a reversal in balanced mode', () => {
    const samples = [
      { x: 50, y: 50, time: 0 },
      { x: 0, y: 50, time: 10 },
      { x: 10, y: 50, time: 20 },
    ];
    expect(predictIntent(samples, [target])).toBeNull();
    expect(
      predictIntent(samples, [target], { mode: 'aggressive' }),
    ).not.toBeNull();
  });
  it('does not trust one sample immediately after a sharp turn', () => {
    const samples = [
      { x: 40, y: 50, time: 0 },
      { x: 0, y: 50, time: 10 },
      { x: 10, y: 50, time: 20 },
    ];
    expect(predictIntent(samples, [target])).toBeNull();
  });
  it('keeps predicting through a speed dip instead of extrapolating a stop', () => {
    const samples = [
      { x: 0, y: 50, time: 0 },
      { x: 20, y: 50, time: 10 },
      { x: 30, y: 50, time: 20 },
    ];
    expect(
      predictIntent(samples, [target], { mode: 'balanced' }),
    ).not.toBeNull();
  });
  it('smooths the arrival estimate during a small speed change', () => {
    const samples = [
      { x: 0, y: 50, time: 0 },
      { x: 11, y: 50, time: 10 },
      { x: 21, y: 50, time: 20 },
    ];
    const close = { rect: { left: 40, right: 60, top: 30, bottom: 70 } };
    const result = predictIntent(samples, [close], { padding: 0 });
    expect(result?.timeToTarget).toBeGreaterThan(17);
    expect(result?.timeToTarget).toBeLessThan(19);
  });
  it('limits history to twelve recent samples', () => {
    const recent = Array.from({ length: 12 }, (_, i) => ({
      x: i * 10,
      y: 50,
      time: i * 10,
    }));
    expect(
      predictIntent(
        [{ x: NaN, y: NaN, time: -1 }, ...recent],
        [{ rect: { ...target.rect, left: 200, right: 240 } }],
      ),
    ).not.toBeNull();
  });
  it('does not mutate samples, targets, or options', () => {
    const samples = Object.freeze(
      path.map((sample) => Object.freeze({ ...sample })),
    );
    const targets = Object.freeze([
      Object.freeze({ rect: Object.freeze({ ...target.rect }) }),
    ]);
    const options = Object.freeze({ mode: 'balanced' as const });
    expect(() => predictIntent(samples, targets, options)).not.toThrow();
  });
  it.each([
    { mode: 'other' },
    { horizonMs: 0 },
    { horizonMs: -1 },
    { horizonMs: Infinity },
    { minSpeed: -1 },
    { padding: NaN },
    { padding: -1 },
    { threshold: -1 },
    { threshold: 1.1 },
  ])('rejects invalid configuration %j', (options) =>
    expect(() =>
      predictIntent(path, [target], options as PredictionOptions),
    ).toThrow(RangeError),
  );
});

describe('prediction properties', () => {
  it('predicts horizontal targets for arbitrary forward speeds and distances', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 10, noNaN: true }),
        fc.double({ min: 1, max: 190, noNaN: true }),
        (speed, arrival) => {
          const samples = [0, 10, 20].map((time) => ({
            x: time * speed,
            y: 0,
            time,
          }));
          const left = (20 + arrival) * speed;
          const result = predictIntent(
            samples,
            [{ rect: { left, right: left + 20, top: -10, bottom: 10 } }],
            { padding: 0 },
          );
          expect(result?.timeToTarget).toBeCloseTo(arrival, 6);
          expect(result!.confidence).toBeGreaterThanOrEqual(0);
          expect(result!.confidence).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 1000 },
    );
  });
  it('is invariant under translation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10000, max: 10000 }),
        fc.integer({ min: -10000, max: 10000 }),
        (dx, dy) => {
          const translated = path.map((s) => ({
            ...s,
            x: s.x + dx,
            y: s.y + dy,
          }));
          const rect = {
            left: target.rect.left + dx,
            right: target.rect.right + dx,
            top: target.rect.top + dy,
            bottom: target.rect.bottom + dy,
          };
          expect(predictIntent(translated, [{ rect }])?.timeToTarget).toBe(
            predictIntent(path, [target])?.timeToTarget,
          );
        },
      ),
      { numRuns: 500 },
    );
  });
  it('is invariant under reflection', () => {
    fc.assert(
      fc.property(fc.integer({ min: 30, max: 180 }), (distance) => {
        const right = {
          rect: { left: distance, right: distance + 10, top: 30, bottom: 70 },
        };
        const left = {
          rect: { left: -distance - 10, right: -distance, top: 30, bottom: 70 },
        };
        const mirrored: PointerSample[] = path.map((s) => ({ ...s, x: -s.x }));
        expect(predictIntent(mirrored, [left])?.timeToTarget).toBe(
          predictIntent(path, [right])?.timeToTarget,
        );
      }),
      { numRuns: 500 },
    );
  });
  it('never returns NaN or an arrival outside its horizon for arbitrary motion', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.integer({ min: -500, max: 500 }),
            y: fc.integer({ min: -500, max: 500 }),
          }),
          { minLength: 6, maxLength: 6 },
        ),
        (points) => {
          const samples = points.map((p, i) => ({ ...p, time: i * 10 }));
          const result = predictIntent(samples, [target], { threshold: 0 });
          if (!result) return;
          expect(Number.isFinite(result.confidence)).toBe(true);
          expect(result.timeToTarget).toBeGreaterThanOrEqual(0);
          expect(result.timeToTarget).toBeLessThanOrEqual(200);
        },
      ),
      { numRuns: 2000 },
    );
  });
});
