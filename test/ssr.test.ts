// @vitest-environment node
import { expect, it } from 'vitest';
import { createIntentObserver } from '../src/browser.js';
import { predictIntent } from '../src/core/index.js';

it('can import and use the core without DOM globals', () =>
  expect(predictIntent([], [])).toBeNull());
it('returns an inert observer during server rendering', () => {
  const observer = createIntentObserver(() => {
    throw new Error('must not run');
  });
  expect(() => {
    observer.update({ enabled: true });
    observer.invalidate();
    observer.destroy();
  }).not.toThrow();
});
