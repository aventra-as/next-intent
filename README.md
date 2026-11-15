# next-intent

Predict cursor intent and prefetch Next.js routes before hover.

Mount one component. `next-intent` watches the direction and speed of the mouse,
finds links along its projected path, and asks the Next.js router to prefetch the
most likely destination. It works with existing links and has no runtime
dependencies beyond the React and Next.js APIs it uses.

## Try it

The package is in development and has not been published to npm yet. Run the
included playground:

```sh
git clone https://github.com/hypervisor/next-intent.git
cd next-intent
npm ci
npm run demo:build
npm run demo:start
```

Open <http://127.0.0.1:3100>. Use a production build to observe real prefetch
requests; Next.js disables route prefetching in development.

To try the package in another project, run `npm pack` in this repository, then
install the generated archive in that project:

```sh
npm install /path/to/next-intent-0.1.0.tgz
```

## App Router

Add `NextIntent` once to your root layout. The library supplies its own client
boundary, so the layout can stay a Server Component.

```tsx
// app/layout.tsx
import { NextIntent } from 'next-intent';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <NextIntent />
        {children}
      </body>
    </html>
  );
}
```

Existing `<Link>` and `<a href>` elements are discovered automatically, including
links inserted after navigation. `NextIntent` also accepts children if you prefer
to wrap your application.

### Use intent to decide what gets prefetched

Next.js normally prefetches visible links. Use `IntentLink` to disable that
viewport behavior and let `NextIntent` choose routes based on cursor movement,
hover, or keyboard focus:

```tsx
import { IntentLink } from 'next-intent';

<IntentLink href="/pricing">Pricing</IntentLink>;
```

`IntentLink` keeps Next.js navigation, accessibility, link props, and refs. It
defaults `prefetch` to `false`; an explicit `prefetch` prop takes precedence.
It requires a mounted `NextIntent` or `useNextIntent`. You can also use standard
`<Link prefetch={false}>` elements.

Plain anchors are eligible for prediction, but retain normal browser navigation.
For Next.js client navigation, use `Link` or `IntentLink`.

## Prefetch aggressiveness

All modes use the same cursor predictor. Choose how early it should act and how
many speculative requests it may make:

| Mode                 | Look-ahead | Target padding | Minimum score | Stable-target delay | Requests per 10 seconds |
| -------------------- | ---------- | -------------- | ------------- | ------------------- | ----------------------- |
| `conservative`       | 120 ms     | 2 px           | 0.8           | 24 ms               | 3                       |
| `balanced` (default) | 200 ms     | 8 px           | 0.6           | 0 ms                | 6                       |
| `aggressive`         | 350 ms     | 16 px          | 0.4           | 0 ms                | 12                      |

Conservative waits for a sustained approach. Aggressive looks farther ahead and
allows more unused requests. Balanced starts as soon as the recent motion points
toward a link. Explicit options override the chosen preset.

The predictor smooths recent motion using elapsed time, so differences in mouse
polling rate and event timing have less influence. It adapts after turns and
stops when the cursor stops.

Predictions are guesses. Fast direction changes can produce unused requests,
and a short lead may not cover network latency. The score is a heuristic, not a
probability. Measure navigation latency and unused downloads in your own app.

## Configuration

```tsx
// app/intent.tsx
'use client';

import { NextIntent } from 'next-intent';

export function Intent() {
  return (
    <NextIntent
      mode="balanced"
      horizonMs={240}
      threshold={0.7}
      maxPrefetches={4}
      filter={(href) => !href.startsWith('/account')}
      onIntent={({ href, reason }) => console.log(reason, href)}
    />
  );
}
```

Function props belong in a Client Component. Mount this configured component
instead of a second `NextIntent`.

| Option            | Default                  | Meaning                                                                           |
| ----------------- | ------------------------ | --------------------------------------------------------------------------------- |
| `enabled`         | `true`                   | Enable prediction and hover/focus fallback.                                       |
| `mode`            | `'balanced'`             | Prefetch aggressiveness preset.                                                   |
| `horizonMs`       | `200`                    | Maximum projected arrival time, in milliseconds.                                  |
| `minSpeed`        | `0.08`                   | Minimum mouse speed, in CSS pixels per millisecond.                               |
| `padding`         | `8`                      | Extra prediction area around each link, in CSS pixels.                            |
| `threshold`       | `0.6`                    | Minimum prediction score, between 0 and 1.                                        |
| `minIntentMs`     | `0` (conservative: `24`) | How long a predicted destination must stay stable across movement frames.         |
| `hover`           | `true`                   | Prefetch on mouse hover when prediction did not already do so.                    |
| `focus`           | `true`                   | Prefetch on focus, including keyboard navigation.                                 |
| `respectSaveData` | `true`                   | Skip requests when Save-Data or a 2G connection is reported.                      |
| `cooldownMs`      | `30000`                  | Local deduplication lifetime; independent of the Next.js cache lifetime.          |
| `maxPrefetches`   | `6`                      | Maximum attempts per window. Presets use 3 / 6 / 12. Zero pauses requests.        |
| `budgetWindowMs`  | `10000`                  | Request budget window, in milliseconds.                                           |
| `maxEntries`      | `256`                    | Maximum remembered destinations. Oldest entries are evicted first.                |
| `root`            | `document`               | A document or element whose links should be observed.                             |
| `filter`          | —                        | `(href, element) => boolean`, applied before prefetch. Throwing rejects the link. |
| `onPrediction`    | —                        | Live `{ origin, projected, prediction }` frame, or `null` when motion clears.     |
| `onIntent`        | —                        | Receives `{ href, element, reason, prediction? }` when a request is submitted.    |
| `onError`         | —                        | Receives `(error, event)` for adapter failures or a throwing `onIntent` callback. |

`prediction` contains the target, score (`confidence`), estimated arrival time,
projected point, and velocity. `onIntent` reports a request submission, not
network completion. Next.js App Router prefetch returns `void`, so its network
failures cannot generally be reported through `onError`.

`onPrediction` runs at most once per movement frame, even if a request is
deduplicated, delayed, or over budget. Coordinates are viewport CSS pixels;
`projected` is the end of the mode's look-ahead, and `prediction` is the selected
visible target or `null`. The callback receives `null` after 150 ms without mouse
movement and on resets such as scrolling, blur, or disabling the observer.
Callback errors are ignored. Keep visualization work small; the playground uses
an SVG overlay without rerendering the page on every mouse movement.

### Exclude links

```tsx
<Link href="/logout" prefetch={false} data-next-intent="off">
  Sign out
</Link>

<section data-next-intent="off">{/* Exclude every link in this subtree. */}</section>
```

The observer skips external origins, non-HTTP URLs, downloads, other browsing
targets, same-page hash links, the current route, disabled/inert links, and
opted-out subtrees. Query strings are preserved; fragments are omitted from
prefetch requests. Offscreen and covered targets are excluded from trajectory
prediction. Mouse drags, touch, and pen movement do not trigger predictions.

`data-next-intent="off"` controls this library. Next.js has its own prefetch
settings, so set `prefetch={false}` on links that should not be prefetched by
either system. Prefetchable routes should be safe to read; keep mutations in
explicit actions. See the Next.js guide on
[prefetch side effects](https://nextjs.org/docs/app/guides/prefetching#triggering-unwanted-side-effects-during-prefetching).

## Hooks and other routers

For a custom component, call `useNextIntent(options)` once. It installs the same
observer as `NextIntent`.

For the Pages Router, import from `next-intent/pages` and mount in `_app.tsx`:

```tsx
import { NextIntent } from 'next-intent/pages';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <NextIntent />
      <Component {...pageProps} />
    </>
  );
}
```

Both adapters handle `basePath`. The Pages adapter preserves locale prefixes
and lets Next.js resolve their locale. Pages Router has no `onInvalidate`
callback, so deduplication there expires on the configured cooldown. Its native
`Link` hover behavior may also prefetch independently of this observer.

Use `next-intent/react` to supply a different router or a custom prefetch action:

```tsx
'use client';

import { useIntent } from 'next-intent/react';

export function Intent() {
  useIntent((href, { onInvalidate }) => {
    return routeCache.prefetch(href, { onInvalidate }); // Your cache/router adapter.
  });
  return null;
}
```

For imperative integration, `createIntentObserver(prefetch, options)` from
`next-intent/browser` returns `update(options)`, `invalidate(href?)`, and
`destroy()`. Call `destroy()` when the observed UI is removed. `update` replaces
options but preserves the request history; changing roots requires a new
observer. Mount one observer per root and avoid overlapping roots.

### Predict other targets

Buttons without `href` have no route to prefetch. Use the pure core to predict
buttons, canvas regions, or other rectangular targets and handle the result:

```ts
import { predictIntent } from 'next-intent/core';

const prediction = predictIntent(
  [
    { x: 0, y: 50, time: 0 },
    { x: 10, y: 50, time: 10 },
    { x: 20, y: 50, time: 20 },
  ],
  [{ id: 'details', rect: { left: 100, right: 160, top: 30, bottom: 70 } }],
);

console.log(prediction?.target.id);
```

Coordinates use CSS pixels in the same coordinate space; timestamps use
monotonically increasing milliseconds. The core has no React, Next.js, or DOM
dependency. It never clicks elements or changes navigation.

## Behavior and compatibility

- ESM with TypeScript declarations. React 18.2/19 and Next.js 15.4/16 peer ranges.
- The example and production browser tests use the pinned Next.js/React versions
  in `package.json`; a peer range is not a claim that every version has been tested.
- Client entry points preserve `'use client'`; the core can run on the server.
- Mouse events are processed at most once per animation frame. Link discovery
  is cached and updated after DOM changes. IntersectionObserver avoids measuring
  known offscreen links when available.
- Listeners, observers, and queued frames are removed on unmount. React renders
  do not reset the deduplication history or add per-link event handlers.
- Hidden tabs and offline connections pause speculation. Data-saving checks use
  the Network Information API where available. Touch users retain normal links;
  keyboard users have focus prefetching.
- App Router invalidation makes a route eligible again on the next intent.
  It does not start a polling loop. Existing requests cannot be cancelled through
  the router's prefetch API.
- DOM discovery covers the configured document subtree. Shadow roots and
  cross-document frames need their own integration. Rewrites that require an
  internal route distinct from the visible URL may need a custom adapter.

Next.js controls what a prefetch request caches. Dynamic data can still require a
request on navigation. See its [prefetch guide](https://nextjs.org/docs/app/guides/prefetching)
and [`router.prefetch` API](https://nextjs.org/docs/app/api-reference/functions/use-router).

## Development

```sh
npm ci
npm run check         # lint, types, coverage, package checks
npm run test:watch
npx playwright install chromium
npm run test:e2e      # production Next.js build and browser tests
DEMO_BASE_PATH=/docs npm run test:e2e
```

Tests cover geometry, generated motion inputs, link eligibility, request budgets,
invalidation races, browser lifecycle, React Strict Mode, and actual pre-hover
requests. Coverage thresholds are enforced in CI. See [CONTRIBUTING.md](CONTRIBUTING.md).

MIT licensed.
