'use client';

import { useRef } from 'react';
import {
  NextIntent,
  type IntentOptions,
  type PredictionFrame,
} from 'next-intent';

export function PredictionOverlay(options: IntentOptions) {
  const svg = useRef<SVGSVGElement>(null);
  const path = useRef<SVGLineElement>(null);
  const origin = useRef<SVGCircleElement>(null);
  const end = useRef<SVGCircleElement>(null);
  const landing = useRef<SVGCircleElement>(null);
  const target = useRef<HTMLAnchorElement | null>(null);

  function draw(frame: PredictionFrame | null) {
    const overlay = svg.current;
    if (!frame) {
      target.current?.removeAttribute('data-predicted');
      target.current = null;
      if (overlay) {
        overlay.dataset.active = 'false';
        overlay.dataset.target = 'false';
      }
      return;
    }
    if (!overlay) return;
    const bounds = overlay.getBoundingClientRect();
    const visible =
      frame.origin.x >= bounds.left &&
      frame.origin.x <= bounds.right &&
      frame.origin.y >= bounds.top &&
      frame.origin.y <= bounds.bottom;
    let nextTarget: HTMLAnchorElement | null = null;
    if (visible && frame.prediction)
      nextTarget = frame.prediction.target.element;
    if (target.current !== nextTarget) {
      target.current?.removeAttribute('data-predicted');
      nextTarget?.setAttribute('data-predicted', 'true');
      target.current = nextTarget;
    }
    overlay.dataset.active = String(Boolean(visible));
    overlay.dataset.target = String(Boolean(nextTarget));
    if (!visible) return;

    function point(element: SVGElement | null, x: number, y: number) {
      element?.setAttribute('cx', String(x - bounds.left));
      element?.setAttribute('cy', String(y - bounds.top));
    }
    // The observer already batches updates to animation frames. Keep transient
    // geometry in the overlay so pointer movement does not rerender the page.
    const endpoint = frame.prediction?.point ?? frame.projected;
    path.current?.setAttribute('x1', String(frame.origin.x - bounds.left));
    path.current?.setAttribute('y1', String(frame.origin.y - bounds.top));
    path.current?.setAttribute('x2', String(endpoint.x - bounds.left));
    path.current?.setAttribute('y2', String(endpoint.y - bounds.top));
    point(origin.current, frame.origin.x, frame.origin.y);
    point(end.current, endpoint.x, endpoint.y);
    end.current?.setAttribute('visibility', nextTarget ? 'hidden' : 'visible');
    landing.current?.setAttribute(
      'visibility',
      nextTarget ? 'visible' : 'hidden',
    );
    if (frame.prediction)
      point(
        landing.current,
        frame.prediction.point.x,
        frame.prediction.point.y,
      );
  }

  return (
    <>
      <NextIntent {...options} onPrediction={draw} />
      <svg
        ref={svg}
        className="prediction-overlay"
        data-active="false"
        data-target="false"
        aria-hidden="true"
      >
        <line ref={path} className="projected-path" />
        <circle ref={origin} className="projection-origin" r="3" />
        <circle ref={end} className="projection-end" r="4" />
        <circle
          ref={landing}
          className="landing-point"
          r="7"
          visibility="hidden"
        />
      </svg>
    </>
  );
}
