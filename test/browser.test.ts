import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIntentObserver } from '../src/browser.js';
import type { IntentObserver, IntentOptions } from '../src/types.js';

let observers: IntentObserver[] = [];
let frames: Map<number, FrameRequestCallback>;
let now: number;
let nextFrame: number;
function anchor(href = '/a', left = 100, top = 30) {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = href;
  document.body.append(a);
  vi.spyOn(a, 'getBoundingClientRect').mockReturnValue({
    x: left,
    y: top,
    left,
    top,
    width: 60,
    height: 40,
    right: left + 60,
    bottom: top + 40,
    toJSON: () => ({}),
  });
  return a;
}
function pointer(
  type: string,
  target: EventTarget = document,
  options: Partial<PointerEvent> = {},
) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(
    event,
    Object.fromEntries(
      Object.entries({
        pointerType: 'mouse',
        buttons: 0,
        isPrimary: true,
        pointerId: 1,
        clientX: 0,
        clientY: 50,
        timeStamp: now,
        ...options,
      }).map(([key, value]) => [key, { value }]),
    ),
  );
  target.dispatchEvent(event);
}
function flush(ms = 10) {
  now += ms;
  const queue = [...frames.values()];
  frames.clear();
  for (const callback of queue) callback(now);
}
function move(
  x: number,
  target: EventTarget = document,
  options: Partial<PointerEvent> = {},
) {
  pointer('pointermove', target, { clientX: x, ...options });
  flush();
}
function setup(options: IntentOptions = {}) {
  const prefetch = vi.fn();
  const onIntent = vi.fn();
  const observer = createIntentObserver(prefetch, {
    mode: 'balanced',
    onIntent,
    ...options,
  });
  observers.push(observer);
  return { prefetch, onIntent, observer };
}
function approach(target: EventTarget = document) {
  move(0, target);
  move(10, target);
  move(20, target);
}

beforeEach(() => {
  now = 0;
  nextFrame = 0;
  frames = new Map();
  vi.spyOn(window.performance, 'now').mockImplementation(() => now);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});
afterEach(() => {
  for (const observer of observers) observer.destroy();
  observers = [];
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'connection');
  Reflect.deleteProperty(document, 'elementFromPoint');
});

describe('browser integration', () => {
  it('prefetches ahead of the cursor without hovering the link', () => {
    const a = anchor();
    const s = setup();
    approach();
    expect(s.prefetch).toHaveBeenCalledOnce();
    expect(s.prefetch.mock.calls[0]![0]).toBe('/a');
    expect(s.onIntent.mock.calls[0]![0]).toMatchObject({
      element: a,
      reason: 'trajectory',
    });
  });
  it('coalesces pointer events into one animation frame', () => {
    const a = anchor();
    const s = setup();
    pointer('pointermove');
    now = 10;
    pointer('pointermove', document, { clientX: 10 });
    expect(frames.size).toBe(1);
    expect(a.getBoundingClientRect).not.toHaveBeenCalled();
    flush();
    expect(s.prefetch).toHaveBeenCalledOnce();
  });
  it('waits for sustained intent in conservative mode', () => {
    anchor();
    const s = setup({ mode: 'conservative' });
    approach();
    expect(s.prefetch).not.toHaveBeenCalled();
    move(30);
    expect(s.prefetch).not.toHaveBeenCalled();
    move(40);
    expect(s.prefetch).toHaveBeenCalledOnce();
  });
  it.each(['touch', 'pen', ''])(
    'ignores %s movement and hover',
    (pointerType) => {
      const a = anchor();
      const s = setup();
      move(0, document, { pointerType });
      move(10, document, { pointerType });
      pointer('pointerover', a, { pointerType });
      expect(s.prefetch).not.toHaveBeenCalled();
    },
  );
  it.each([{ buttons: 1 }, { isPrimary: false }])(
    'ignores unsupported pointer state %j',
    (options) => {
      anchor();
      const s = setup();
      move(0, document, options);
      move(10, document, options);
      expect(s.prefetch).not.toHaveBeenCalled();
    },
  );
  it('resets when pointer identity changes', () => {
    anchor();
    const s = setup();
    move(0);
    move(10, document, { pointerId: 2 });
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('resets after stale samples', () => {
    anchor();
    const s = setup();
    move(0);
    now = 500;
    move(10);
    expect(s.prefetch).not.toHaveBeenCalled();
    move(20);
    expect(s.prefetch).toHaveBeenCalledOnce();
  });
  it('resets duplicate timestamps', () => {
    anchor();
    const s = setup();
    move(0);
    move(10, document, { timeStamp: 0 });
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('keeps a bounded history under high-frequency movement', () => {
    anchor();
    const s = setup();
    for (let i = 0; i < 30; i++) {
      now = i;
      pointer('pointermove', document, { clientX: i });
    }
    flush();
    expect(s.prefetch).toHaveBeenCalledOnce();
  });
  it('supports mouse hover fallback', () => {
    const a = anchor();
    const s = setup();
    pointer('pointerover', a);
    expect(s.onIntent.mock.calls[0]![0].reason).toBe('hover');
  });
  it('finds a link when hovering its child', () => {
    const a = anchor();
    const child = document.createElement('span');
    a.append(child);
    const s = setup();
    pointer('pointerover', child);
    expect(s.prefetch).toHaveBeenCalledOnce();
  });
  it('supports keyboard focus fallback', () => {
    const a = anchor();
    const s = setup();
    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(s.onIntent.mock.calls[0]![0].reason).toBe('focus');
  });
  it('can disable both fallbacks', () => {
    const a = anchor();
    const s = setup({ hover: false, focus: false });
    pointer('pointerover', a);
    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('ignores hover during a drag', () => {
    const a = anchor();
    const s = setup();
    pointer('pointerover', a, { buttons: 1 });
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('ignores fallback events on non-links or document', () => {
    const s = setup();
    pointer('pointerover', document);
    pointer('pointerover', document.body);
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it.each([
    { saveData: true },
    { effectiveType: '2g' },
    { effectiveType: 'slow-2g' },
  ])('respects connection policy %j', (connection) => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: connection,
    });
    const a = anchor();
    const s = setup();
    approach();
    pointer('pointerover', a);
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('allows opting out of connection policy', () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: true },
    });
    anchor();
    const s = setup({ respectSaveData: false });
    approach();
    expect(s.prefetch).toHaveBeenCalledOnce();
  });
  it('skips offline navigation', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    anchor();
    const s = setup();
    approach();
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('skips hidden documents', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    anchor();
    const s = setup();
    approach();
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('rechecks policy before a queued frame', () => {
    anchor();
    const s = setup();
    pointer('pointermove');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    flush();
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('can be enabled after mounting', () => {
    anchor();
    const s = setup({ enabled: false });
    approach();
    expect(s.prefetch).not.toHaveBeenCalled();
    s.observer.update({ mode: 'balanced' });
    approach();
    expect(s.prefetch).toHaveBeenCalledOnce();
  });
  it('preserves request history across option changes', () => {
    anchor();
    const s = setup();
    approach();
    s.observer.update({ mode: 'balanced', padding: 2 });
    approach();
    expect(s.prefetch).toHaveBeenCalledOnce();
  });
  it('clears queued work when disabled', () => {
    anchor();
    const s = setup();
    pointer('pointermove');
    s.observer.update({ enabled: false });
    expect(frames.size).toBe(0);
  });
  it('uses a route filter', () => {
    anchor();
    const s = setup({ filter: () => false });
    approach();
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('ignores a route whose filter throws', () => {
    anchor();
    const s = setup({
      filter: () => {
        throw new Error('bad filter');
      },
    });
    approach();
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('skips excluded links in trajectory and fallback', () => {
    const a = anchor('https://other.com');
    const s = setup();
    approach();
    pointer('pointerover', a);
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it.each(['hidden', 'collapse'])('skips visibility:%s', (visibility) => {
    const a = anchor();
    a.style.visibility = visibility;
    const s = setup();
    approach();
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it.each([{ display: 'none' }, { pointerEvents: 'none' }])(
    'skips styles %j',
    (style) => {
      const a = anchor();
      Object.assign(a.style, style);
      const s = setup();
      approach();
      expect(s.prefetch).not.toHaveBeenCalled();
    },
  );
  it.each([
    [-100, 30],
    [2000, 30],
    [100, -100],
    [100, 2000],
  ])('skips an offscreen target at %s,%s', (left, top) => {
    anchor('/a', left, top);
    const s = setup();
    approach();
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('skips a zero-size target', () => {
    const a = anchor();
    vi.mocked(a.getBoundingClientRect).mockReturnValue(new DOMRect());
    const s = setup();
    approach();
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('skips covered links', () => {
    anchor();
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => document.body,
    });
    const s = setup();
    approach();
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('accepts a visible child at the predicted point', () => {
    const a = anchor();
    const child = document.createElement('span');
    a.append(child);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => child,
    });
    const s = setup();
    approach();
    expect(s.prefetch).toHaveBeenCalledOnce();
  });
  it('skips a point outside the hit-test surface', () => {
    anchor();
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => null,
    });
    const s = setup();
    approach();
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('selects an uncovered target behind an occluded candidate', () => {
    anchor('/a');
    const b = anchor('/b', 200);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: (x: number) => (x > 190 ? b : document.body),
    });
    const s = setup();
    approach();
    expect(s.prefetch.mock.calls[0]![0]).toBe('/b');
  });
  it('discovers links inserted after mounting', async () => {
    const s = setup();
    anchor();
    await Promise.resolve();
    approach();
    expect(s.prefetch).toHaveBeenCalledOnce();
  });
  it('rediscovers anchors when href is added', async () => {
    const a = anchor();
    a.removeAttribute('href');
    const s = setup();
    a.href = '/added';
    await Promise.resolve();
    approach();
    expect(s.prefetch.mock.calls[0]![0]).toBe('/added');
  });
  it('reads updated destinations', async () => {
    const a = anchor();
    const s = setup();
    a.href = '/new';
    await Promise.resolve();
    approach();
    expect(s.prefetch.mock.calls[0]![0]).toBe('/new');
  });
  it('drops detached links', async () => {
    const a = anchor();
    const s = setup();
    a.remove();
    await Promise.resolve();
    approach();
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('honors a restricted root', () => {
    const section = document.createElement('section');
    document.body.append(section);
    const outside = anchor('/outside');
    const inside = anchor('/inside');
    section.append(inside);
    const s = setup({ root: section });
    pointer('pointerover', outside);
    expect(s.prefetch).not.toHaveBeenCalled();
    approach(section);
    expect(s.prefetch.mock.calls[0]![0]).toBe('/inside');
  });
  it('supports an anchor as the root', () => {
    const a = anchor();
    const s = setup({ root: a });
    approach(a);
    expect(s.prefetch).toHaveBeenCalledOnce();
  });
  it('ignores a fallback link wrapping the configured root', () => {
    const a = anchor();
    const span = document.createElement('span');
    a.append(span);
    const s = setup({ root: span });
    pointer('pointerover', span);
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it.each(['pointerdown', 'pointercancel', 'scroll', 'visibilitychange'])(
    'resets on %s',
    (type) => {
      anchor();
      const s = setup();
      move(0);
      document.dispatchEvent(new Event(type));
      move(10);
      expect(s.prefetch).not.toHaveBeenCalled();
    },
  );
  it.each(['blur', 'resize', 'popstate'])('resets on window %s', (type) => {
    anchor();
    const s = setup();
    move(0);
    window.dispatchEvent(new Event(type));
    move(10);
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('resets when the pointer leaves the document', () => {
    anchor();
    const s = setup();
    move(0);
    pointer('pointerout', document, { relatedTarget: null });
    move(10);
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('keeps history when moving between descendants', () => {
    anchor();
    const s = setup();
    move(0);
    pointer('pointerout', document, { relatedTarget: document.body });
    move(10);
    expect(s.prefetch).toHaveBeenCalledOnce();
  });
  it('clears pending intent after moving away', () => {
    anchor();
    const s = setup({ mode: 'balanced', minIntentMs: 30 });
    approach();
    move(10);
    move(0);
    move(10);
    move(20);
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('invalidates a route for future intent', () => {
    const a = anchor();
    const s = setup();
    approach();
    s.observer.invalidate('/a');
    pointer('pointerover', a);
    expect(s.prefetch).toHaveBeenCalledTimes(2);
  });
  it('disconnects every listener and cancels work on destruction', () => {
    const a = anchor();
    const s = setup();
    pointer('pointermove');
    s.observer.destroy();
    s.observer.destroy();
    expect(frames.size).toBe(0);
    approach();
    pointer('pointerover', a);
    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(s.prefetch).not.toHaveBeenCalled();
  });
  it('uses intersection visibility and cleans up removed targets', async () => {
    let notify!: IntersectionObserverCallback;
    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();
    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe = observe;
      unobserve = unobserve;
      disconnect = disconnect;
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    const a = anchor();
    const s = setup();
    expect(observe).toHaveBeenCalledWith(a);
    const entry = {
      target: a,
      isIntersecting: false,
      boundingClientRect: new DOMRect(),
      intersectionRatio: 0,
      intersectionRect: new DOMRect(),
      rootBounds: null,
      time: 0,
    };
    notify([entry], {} as IntersectionObserver);
    approach();
    expect(s.prefetch).not.toHaveBeenCalled();
    notify([{ ...entry, isIntersecting: true }], {} as IntersectionObserver);
    approach();
    expect(s.prefetch).toHaveBeenCalledOnce();
    a.remove();
    await Promise.resolve();
    move(30);
    expect(unobserve).toHaveBeenCalledWith(a);
    s.observer.destroy();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
