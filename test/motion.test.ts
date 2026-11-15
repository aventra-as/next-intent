import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { predictIntent, type PointerSample } from '../src/core/index.js';

const target = { rect: { left: 100, right: 140, top: 30, bottom: 70 } };
const modes = ['conservative', 'balanced', 'aggressive'] as const;

describe('motion regressions', () => {
  it.each(modes)('tolerates irregular event timing in %s mode', (mode) => {
    const samples = [
      { x: 0, y: 50, time: 0 },
      { x: 15, y: 50, time: 10 },
      { x: 30, y: 50, time: 30 },
      { x: 45, y: 50, time: 41 },
      { x: 60, y: 50, time: 60 },
    ];
    expect(predictIntent(samples, [target], { mode })?.target).toBe(target);
  });
  it.each(modes)('tolerates small corrections in %s mode', (mode) => {
    const samples = [0, 16, 32, 48, 64].map((time, i) => ({
      x: time,
      y: 50 + (i % 2),
      time,
    }));
    expect(predictIntent(samples, [target], { mode })?.target).toBe(target);
  });
  it('adapts after two samples in a new direction', () => {
    const samples = [
      { x: 0, y: 0, time: 0 },
      { x: 20, y: 0, time: 10 },
      { x: 40, y: 0, time: 20 },
      { x: 40, y: 10, time: 30 },
      { x: 40, y: 20, time: 40 },
    ];
    const below = { rect: { left: 30, right: 50, top: 100, bottom: 140 } };
    expect(predictIntent(samples, [target, below])?.target).toBe(below);
  });
  it('starts predicting when movement resumes from rest', () => {
    const samples = [
      { x: 0, y: 50, time: 0 },
      { x: 0, y: 50, time: 10 },
      { x: 20, y: 50, time: 20 },
    ];
    expect(predictIntent(samples, [target])?.target).toBe(target);
  });
  it('stops predicting immediately when the pointer stops', () => {
    const samples = [
      { x: 0, y: 50, time: 0 },
      { x: 20, y: 50, time: 10 },
      { x: 20, y: 50, time: 20 },
    ];
    expect(predictIntent(samples, [target])).toBeNull();
  });
  it('looks progressively farther ahead as aggressiveness increases', () => {
    const samples = [
      { x: 0, y: 50, time: 0 },
      { x: 10, y: 50, time: 10 },
    ];
    const distant = { rect: { ...target.rect, left: 280, right: 320 } };
    expect(
      predictIntent(samples, [distant], { mode: 'conservative' }),
    ).toBeNull();
    expect(predictIntent(samples, [distant], { mode: 'balanced' })).toBeNull();
    expect(
      predictIntent(samples, [distant], { mode: 'aggressive' }),
    ).not.toBeNull();
  });
  it('respects explicit values instead of silently replacing them with preset values', () => {
    const samples = [
      { x: 0, y: 50, time: 0 },
      { x: 10, y: 50, time: 10 },
    ];
    expect(
      predictIntent(samples, [target], { mode: 'aggressive', horizonMs: 20 }),
    ).toBeNull();
  });
  it('does not overflow for extreme but finite coordinates', () => {
    const samples = [
      { x: -1e308, y: 50, time: 0 },
      { x: 1e308, y: 50, time: 1 },
    ];
    expect(predictIntent(samples, [target])).toBeNull();
  });
  it('gives consistent results across mouse polling rates', () => {
    const sample = (interval: number): PointerSample[] => {
      const result = [];
      for (let time = 0; time <= 64; time += interval)
        result.push({ x: time, y: 50, time });
      return result;
    };
    const slow = predictIntent(sample(16), [target]);
    const fast = predictIntent(sample(4), [target]);
    expect(fast?.timeToTarget).toBeCloseTo(slow!.timeToTarget);
  });
  it('never becomes less willing to prefetch when aggressiveness increases', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 90 }),
        fc.integer({ min: 1, max: 5 }),
        (distance, speed) => {
          const samples = [
            { x: 0, y: 50, time: 0 },
            { x: 10 * speed, y: 50, time: 10 },
          ];
          const candidate = {
            rect: {
              left: 10 * speed + distance,
              right: 10 * speed + distance + 20,
              top: 30,
              bottom: 70,
            },
          };
          const outcomes = modes.map((mode) =>
            Boolean(predictIntent(samples, [candidate], { mode })),
          );
          if (outcomes[0]) expect(outcomes[1]).toBe(true);
          if (outcomes[1]) expect(outcomes[2]).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });
});
