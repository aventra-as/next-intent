import { estimateMotion, selectTarget } from './core/predict.js';
import type { PointerSample } from './core/types.js';
import { getLinkHref } from './links.js';
import { resolveOptions } from './options.js';
import { PrefetchScheduler } from './scheduler.js';
import type {
  IntentEvent,
  PredictionFrame,
  IntentObserver,
  IntentOptions,
  LinkTarget,
  Prefetch,
} from './types.js';

export type {
  IntentEvent,
  PredictionFrame,
  IntentObserver,
  IntentOptions,
  LinkTarget,
  Prefetch,
  PrefetchContext,
} from './types.js';

/** Observe ordinary anchors, including those rendered by next/link. */
export function createIntentObserver(
  prefetch: Prefetch,
  options: IntentOptions = {},
): IntentObserver {
  let config = resolveOptions(options);
  const root =
    options.root ?? (typeof document === 'undefined' ? undefined : document);
  const doc = root?.ownerDocument ?? (root as Document | undefined);
  const win = doc?.defaultView;
  if (!root || !doc || !win)
    return { update: () => {}, invalidate: () => {}, destroy: () => {} };

  const scheduler = new PrefetchScheduler(prefetch, () =>
    win.performance.now(),
  );
  let samples: PointerSample[] = [];
  let anchors: HTMLAnchorElement[] = [];
  const visibility = new Map<Element, boolean>();
  let dirty = true;
  let frame: number | undefined;
  let destroyed = false;
  let previewActive = false;
  let idleTimer: number | undefined;
  let pending: { href: string; since: number } | undefined;
  let pointerId: number | undefined;
  const intersection =
    typeof IntersectionObserver === 'undefined'
      ? undefined
      : new IntersectionObserver((entries) => {
          for (const entry of entries)
            visibility.set(entry.target, entry.isIntersecting);
        });

  function preview(value: PredictionFrame | null) {
    if (!config.onPrediction || (!value && !previewActive)) return;
    previewActive = value !== null;
    try {
      config.onPrediction(value);
    } catch {
      // Visualization is optional and must not interrupt request scheduling.
    }
  }

  function reset() {
    win!.clearTimeout(idleTimer);
    idleTimer = undefined;
    preview(null);
    samples = [];
    pending = undefined;
    pointerId = undefined;
    if (frame !== undefined) win!.cancelAnimationFrame(frame);
    frame = undefined;
  }

  function allowed(): boolean {
    if (
      !config.enabled ||
      doc!.visibilityState === 'hidden' ||
      win!.navigator.onLine === false
    )
      return false;
    if (!config.respectSaveData) return true;
    const connection = (
      win!.navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    return (
      !connection?.saveData &&
      connection?.effectiveType !== '2g' &&
      connection?.effectiveType !== 'slow-2g'
    );
  }

  function eligible(element: HTMLAnchorElement): string | null {
    const href = getLinkHref(element, win!.location);
    if (!href) return null;
    try {
      if (config.filter && !config.filter(href, element)) return null;
    } catch {
      return null;
    }
    return href;
  }

  function discover() {
    if (!dirty) return;
    dirty = false;
    const next = Array.from(
      root!.querySelectorAll<HTMLAnchorElement>('a[href]'),
    );
    if (root!.nodeType === 1 && (root as HTMLElement).matches('a[href]'))
      next.unshift(root as HTMLAnchorElement);
    const nextSet = new Set(next);
    const previous = new Set(anchors);
    for (const anchor of anchors) {
      if (nextSet.has(anchor)) continue;
      intersection?.unobserve(anchor);
      visibility.delete(anchor);
    }
    for (const anchor of next) {
      if (!previous.has(anchor)) intersection?.observe(anchor);
    }
    anchors = next;
  }

  function evaluate() {
    frame = undefined;
    if (destroyed || !allowed()) {
      reset();
      return;
    }
    discover();
    const targets: LinkTarget[] = [];
    for (const element of anchors) {
      if (visibility.get(element) === false) continue;
      const href = eligible(element);
      if (!href) continue;
      const rect = element.getBoundingClientRect();
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        rect.bottom <= 0 ||
        rect.right <= 0 ||
        rect.top >= win!.innerHeight ||
        rect.left >= win!.innerWidth
      )
        continue;
      const style = win!.getComputedStyle(element);
      if (
        style.visibility !== 'visible' ||
        style.display === 'none' ||
        style.pointerEvents === 'none'
      )
        continue;
      targets.push({
        element,
        href,
        rect: {
          left: Math.max(0, rect.left),
          top: Math.max(0, rect.top),
          right: Math.min(win!.innerWidth, rect.right),
          bottom: Math.min(win!.innerHeight, rect.bottom),
        },
      });
    }
    // Drop occluded candidates before selecting the winner, so an overlay link can win.
    const motion = estimateMotion(samples, config);
    let prediction = selectTarget(motion, targets, config);
    while (prediction && typeof doc!.elementFromPoint === 'function') {
      const { rect, element } = prediction.target;
      const x = Math.min(
        rect.right - 0.5,
        Math.max(rect.left + 0.5, prediction.point.x),
      );
      const y = Math.min(
        rect.bottom - 0.5,
        Math.max(rect.top + 0.5, prediction.point.y),
      );
      const hit = doc!.elementFromPoint(x, y);
      if (hit && element.contains(hit)) break;
      targets.splice(targets.indexOf(prediction.target), 1);
      prediction = selectTarget(motion, targets, config);
    }
    if (motion) {
      preview({
        origin: motion.origin,
        projected: {
          x: motion.origin.x + motion.velocity.x * config.horizonMs,
          y: motion.origin.y + motion.velocity.y * config.horizonMs,
        },
        prediction,
      });
    } else {
      preview(null);
    }
    if (!prediction) {
      pending = undefined;
      return;
    }
    const now = win!.performance.now();
    if (pending?.href !== prediction.target.href)
      pending = { href: prediction.target.href, since: now };
    if (now - pending.since < config.minIntentMs) return;
    scheduler.request(
      {
        href: prediction.target.href,
        element: prediction.target.element,
        reason: 'trajectory',
        prediction,
      },
      config,
    );
  }

  function move(event: PointerEvent) {
    if (
      event.pointerType !== 'mouse' ||
      event.buttons !== 0 ||
      event.isPrimary === false ||
      !allowed()
    ) {
      reset();
      return;
    }
    if (pointerId !== undefined && pointerId !== event.pointerId) reset();
    pointerId = event.pointerId;
    const sample = {
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
    };
    const previous = samples.at(-1);
    if (
      previous &&
      (sample.time <= previous.time || sample.time - previous.time > 150)
    )
      samples = [];
    samples = samples.filter((item) => sample.time - item.time <= 120);
    samples.push(sample);
    if (samples.length > 12) samples.shift();
    if (frame === undefined) frame = win!.requestAnimationFrame(evaluate);
    if (config.onPrediction) {
      win!.clearTimeout(idleTimer);
      idleTimer = win!.setTimeout(reset, 150);
    }
  }

  function fallback(event: Event, reason: IntentEvent['reason']) {
    if (!allowed()) return;
    const target = event.target;
    if (!target || !(target as Element).closest) return;
    const element = (target as Element).closest<HTMLAnchorElement>('a[href]');
    if (!element || !root!.contains(element)) return;
    const href = eligible(element);
    if (href) scheduler.request({ href, element, reason }, config);
  }

  function over(event: PointerEvent) {
    if (config.hover && event.pointerType === 'mouse' && event.buttons === 0)
      fallback(event, 'hover');
  }
  function focus(event: FocusEvent) {
    if (config.focus) fallback(event, 'focus');
  }
  function out(event: PointerEvent) {
    if (!event.relatedTarget || !root!.contains(event.relatedTarget as Node))
      reset();
  }
  const mutation = new MutationObserver(() => {
    dirty = true;
  });
  mutation.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href'],
  });
  discover();
  const eventRoot: EventTarget = root;
  const listeners: [EventTarget, string, EventListener, boolean][] = [
    [eventRoot, 'pointermove', move as EventListener, false],
    [eventRoot, 'pointerover', over as EventListener, false],
    [eventRoot, 'focusin', focus as EventListener, false],
    [eventRoot, 'pointerout', out as EventListener, false],
    [eventRoot, 'pointerdown', reset, false],
    [eventRoot, 'pointercancel', reset, false],
    [doc, 'scroll', reset, true],
    [doc, 'visibilitychange', reset, false],
    [win, 'blur', reset, false],
    [win, 'resize', reset, false],
    [win, 'popstate', reset, false],
  ];
  for (const [target, name, listener, capture] of listeners)
    target.addEventListener(name, listener, { passive: true, capture });

  return {
    update(next) {
      config = resolveOptions(next);
      if (!config.enabled) reset();
      if (!config.onPrediction) {
        win!.clearTimeout(idleTimer);
        previewActive = false;
      }
    },
    invalidate: (href) => scheduler.invalidate(href),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      reset();
      mutation.disconnect();
      intersection?.disconnect();
      for (const [target, name, listener, capture] of listeners)
        target.removeEventListener(name, listener, capture);
      anchors = [];
      visibility.clear();
      scheduler.destroy();
    },
  };
}
