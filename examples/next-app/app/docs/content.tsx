import type { ReactNode } from 'react';
import Link from 'next/link';
import { Code } from './code';
import { StructuredData } from '../structured-data';
import { siteUrl } from '../site';

type Section = { id: string; title: string; body: ReactNode };
type Doc = { title: string; description: string; sections: Section[] };
const appSetup = `// app/layout.tsx
import { NextIntent } from 'next-intent';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NextIntent />
        {children}
      </body>
    </html>
  );
}`;
const options = [
  ['enabled', 'true', 'Enable prediction and hover/focus fallback.'],
  [
    'mode',
    'balanced',
    'conservative, balanced, or aggressive. Explicit options override the preset.',
  ],
  [
    'horizonMs',
    '200',
    'Maximum look-ahead in milliseconds. Must be greater than zero.',
  ],
  ['minSpeed', '0.08', 'Minimum cursor speed in CSS pixels per millisecond.'],
  ['padding', '8', 'Extra target area in CSS pixels.'],
  ['threshold', '0.6', 'Minimum heuristic score, between 0 and 1.'],
  [
    'minIntentMs',
    '0',
    'Stable-target delay in milliseconds. Conservative uses 24.',
  ],
  ['hover / focus', 'true', 'Mouse hover and keyboard focus fallbacks.'],
  [
    'respectSaveData',
    'true',
    'Skip speculation on Save-Data, slow-2g, and 2g connections where reported.',
  ],
  [
    'cooldownMs',
    '30000',
    'Deduplication lifetime in milliseconds. Separate from the router cache.',
  ],
  [
    'maxPrefetches',
    '6',
    'Attempts per rolling window: conservative 3, balanced 6, aggressive 12. Zero pauses requests.',
  ],
  [
    'budgetWindowMs',
    '10000',
    'Rolling budget window in milliseconds. Must be greater than zero.',
  ],
  [
    'maxEntries',
    '256',
    'Maximum deduplication entries. Positive integer; oldest entries are evicted first.',
  ],
  [
    'root',
    'document',
    'Document or HTMLElement to observe. Changing it recreates the observer.',
  ],
  [
    'filter',
    '—',
    '(href, element) => boolean. Return false to exclude a link. Throwing also excludes it.',
  ],
  [
    'onIntent',
    '—',
    'Receives a request submission: href, element, reason, and optional prediction.',
  ],
  [
    'onPrediction',
    '—',
    'Receives each live motion frame, or null when motion clears.',
  ],
  [
    'onError',
    '—',
    'Receives (error, event) for adapter failures and throwing onIntent callbacks.',
  ],
];

export const docs: Record<string, Doc> = {
  start: {
    title: 'Getting started',
    description:
      'Install next-intent in a Next.js App Router or Pages Router project. Set up cursor-based route prefetching with TypeScript and React.',
    sections: [
      {
        id: 'install',
        title: 'Install',
        body: (
          <>
            <Code label="Terminal">npm install next-intent</Code>
            <p>
              ESM with TypeScript declarations. Supports React 18.2 or 19 and
              Next.js 15.4 or 16. The package adds no runtime dependencies.
            </p>
          </>
        ),
      },
      {
        id: 'app-router',
        title: 'App Router',
        body: (
          <>
            <p>
              Mount <code>NextIntent</code> once in your root layout. It
              supplies its own client boundary, so your layout can remain a
              Server Component.
            </p>
            <Code label="app/layout.tsx">{appSetup}</Code>
            <p>
              Existing links are discovered automatically, including links added
              after navigation. The default mode is <code>balanced</code>.
            </p>
          </>
        ),
      },
      {
        id: 'links',
        title: 'Let intent control prefetching',
        body: (
          <>
            <p>
              Next.js normally prefetches visible links. Use{' '}
              <code>IntentLink</code> to turn off viewport prefetching and let
              cursor movement, hover, or keyboard focus trigger it.
            </p>
            <Code label="Navigation link">{`import { IntentLink } from 'next-intent';

<IntentLink href="/pricing">Pricing</IntentLink>`}</Code>
            <p>
              You can also use <code>{'<Link prefetch={false} />'}</code>. Plain
              anchors are eligible too, but retain normal browser navigation.{' '}
              <code>IntentLink</code> needs a mounted <code>NextIntent</code> or{' '}
              <code>useNextIntent</code>.
            </p>
          </>
        ),
      },
      {
        id: 'pages-router',
        title: 'Pages Router',
        body: (
          <>
            <Code label="pages/_app.tsx">{`import { NextIntent } from 'next-intent/pages';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return <><NextIntent /><Component {...pageProps} /></>;
}`}</Code>
            <p>
              Both adapters handle <code>basePath</code>. The Pages adapter
              preserves locale prefixes. Native Pages Router link hover
              prefetching may also run independently.
            </p>
          </>
        ),
      },
      {
        id: 'verify',
        title: 'Verify in a production build',
        body: (
          <>
            <Code label="Terminal">npm run build && npm run start</Code>
            <p>
              Next.js disables route prefetching in development. In a production
              build, move toward a link and inspect network requests before
              hover. The <Link href="/">playground</Link> makes the projected
              path and selected target visible.
            </p>
          </>
        ),
      },
    ],
  },
  modes: {
    title: 'Prediction & modes',
    description:
      'Choose how early to prefetch and how much speculation to allow.',
    sections: [
      {
        id: 'presets',
        title: 'Aggressiveness presets',
        body: (
          <>
            <p>
              All modes share one predictor. Each preset changes its look-ahead,
              target tolerance, score threshold, and request budget.
            </p>
            <div className="docs-table">
              <table>
                <thead>
                  <tr>
                    <th>Mode</th>
                    <th>Look-ahead</th>
                    <th>Padding</th>
                    <th>Score</th>
                    <th>Delay</th>
                    <th>Requests / 10 s</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Conservative</td>
                    <td>120 ms</td>
                    <td>2 px</td>
                    <td>0.8</td>
                    <td>24 ms</td>
                    <td>3</td>
                  </tr>
                  <tr>
                    <td>Balanced</td>
                    <td>200 ms</td>
                    <td>8 px</td>
                    <td>0.6</td>
                    <td>0 ms</td>
                    <td>6</td>
                  </tr>
                  <tr>
                    <td>Aggressive</td>
                    <td>350 ms</td>
                    <td>16 px</td>
                    <td>0.4</td>
                    <td>0 ms</td>
                    <td>12</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Balanced is the default. Conservative waits for a sustained
              approach; aggressive can start farther away and allows more unused
              requests.
            </p>
            <Code label="Choose a mode">
              {'<NextIntent mode="conservative" />'}
            </Code>
          </>
        ),
      },
      {
        id: 'motion',
        title: 'From motion to a target',
        body: (
          <>
            <ol>
              <li>
                Collect recent mouse positions and timestamps, then evaluate at
                most once per animation frame.
              </li>
              <li>
                Estimate velocity using recent motion weighted by elapsed time.
                Discard incompatible motion after a sharp turn.
              </li>
              <li>
                Project a ray and find eligible link rectangles within the
                look-ahead. Skip hidden, offscreen, and covered links.
              </li>
              <li>
                Select the earliest intersection above the score threshold, then
                apply the stable-target delay, deduplication, and request
                budget.
              </li>
            </ol>
            <p>
              The score is a heuristic, not a calibrated probability. A fast
              change of direction can produce an unused request. Measure both
              navigation latency and unused downloads in your app.
            </p>
          </>
        ),
      },
      {
        id: 'visualization',
        title: 'Reading the playground',
        body: (
          <>
            <p>
              The dashed line projects recent cursor motion. Its maximum length
              follows the selected mode’s look-ahead. A green link and landing
              marker identify the current prediction; the line ends at that
              target.
            </p>
            <p>
              “Predicted” is live. “Requested” records a past prefetch
              submission. Moving toward an already requested link still produces
              a live highlight. The overlay clears after 150 ms without
              movement, or when the pointer leaves the playground.
            </p>
            <p>
              Changing modes or resetting clears the demo’s intent history.
              Next.js may still retain previously prefetched routes.
            </p>
          </>
        ),
      },
      {
        id: 'fallbacks',
        title: 'Fallbacks and limits',
        body: (
          <>
            <p>
              Mouse hover and keyboard focus are enabled by default. Touch, pen,
              and dragging do not trigger trajectory prediction. Hidden tabs,
              offline connections, and reported data-saving connections pause
              speculation.
            </p>
            <p>
              Prefetching does not click a link or guarantee that every resource
              will be cached. Next.js decides what the route prefetch loads;
              dynamic data may still require a request on navigation.
            </p>
          </>
        ),
      },
    ],
  },
  configuration: {
    title: 'Configuration',
    description:
      'Start with a preset, then override the behavior your application needs.',
    sections: [
      {
        id: 'client-component',
        title: 'Configure in a Client Component',
        body: (
          <>
            <p>
              Function props belong in a Client Component. Mount this component
              once in place of an additional <code>NextIntent</code>.
            </p>
            <Code label="app/intent.tsx">{`'use client';
import { NextIntent } from 'next-intent';

export function Intent() {
  return <NextIntent
    mode="balanced"
    horizonMs={240}
    maxPrefetches={4}
    filter={(href) => !href.startsWith('/account')}
    onIntent={({ href, reason }) => console.log(reason, href)}
  />;
}`}</Code>
          </>
        ),
      },
      {
        id: 'options',
        title: 'Options',
        body: (
          <>
            <p>
              Defaults below use balanced mode. Numeric options must be finite
              and nonnegative; request and entry counts must be integers.
            </p>
            <div className="docs-table">
              <table>
                <thead>
                  <tr>
                    <th>Option</th>
                    <th>Default</th>
                    <th>Behavior</th>
                  </tr>
                </thead>
                <tbody>
                  {options.map(([name, value, meaning]) => (
                    <tr key={name}>
                      <td>
                        <code>{name}</code>
                      </td>
                      <td>{value}</td>
                      <td>{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ),
      },
      {
        id: 'exclude',
        title: 'Exclude links or sections',
        body: (
          <>
            <Code label="Opt out">{`<Link href="/logout" prefetch={false} data-next-intent="off">
  Sign out
</Link>

<section data-next-intent="off">
  {/* Links in this subtree are excluded. */}
</section>`}</Code>
            <p>
              The attribute controls next-intent. Next.js has separate prefetch
              behavior, so disable that too where needed. External origins,
              downloads, non-HTTP URLs, other browsing targets, disabled or
              inert links, same-page hash links, and the current route are
              already excluded.
            </p>
          </>
        ),
      },
      {
        id: 'requests',
        title: 'Request budgets and cache',
        body: (
          <>
            <p>
              The cooldown suppresses repeated requests for a route. The rolling
              budget limits attempts across routes. App Router invalidation
              makes a route eligible again on future intent; it does not start a
              polling loop. Pages Router deduplication expires on the cooldown.
            </p>
            <p>
              These controls are separate from Next.js’s cache lifetime. The
              router’s prefetch API cannot cancel requests that have already
              started.
            </p>
          </>
        ),
      },
    ],
  },
  api: {
    title: 'API reference',
    description:
      'Next.js components, React hooks, a browser observer, and a pure prediction core.',
    sections: [
      {
        id: 'next',
        title: 'next-intent',
        body: (
          <>
            <Code label="App Router exports">{`import { NextIntent, IntentLink, useNextIntent } from 'next-intent';
import type { IntentOptions, IntentEvent, PredictionFrame } from 'next-intent';`}</Code>
            <p>
              <code>NextIntent</code> accepts every{' '}
              <Link href="/docs/configuration#options">
                configuration option
              </Link>{' '}
              and optional children. <code>useNextIntent(options)</code>{' '}
              installs the same observer in a custom component and returns
              nothing. Mount one observer per root.
            </p>
            <p>
              <code>IntentLink</code> forwards the Next.js Link props and ref.
              Its <code>prefetch</code> defaults to <code>false</code>; an
              explicit value takes precedence.
            </p>
            <p>
              <code>next-intent/pages</code> exports <code>NextIntent</code> and{' '}
              <code>useNextIntent</code> for the Pages Router.
            </p>
          </>
        ),
      },
      {
        id: 'events',
        title: 'Request and prediction events',
        body: (
          <>
            <Code label="Event shapes">{`// onIntent(event): a request was submitted, not necessarily completed.
type IntentEvent = {
  href: string;
  element: HTMLAnchorElement;
  reason: 'trajectory' | 'hover' | 'focus';
  prediction?: IntentPrediction<LinkTarget>;
};

// onPrediction(frame): live motion, even when a request is deduplicated.
type PredictionFrame = {
  origin: { x: number; y: number };
  projected: { x: number; y: number };
  prediction: IntentPrediction<LinkTarget> | null;
};`}</Code>
            <p>
              <code>onPrediction</code> also receives <code>null</code> when
              motion clears. Coordinates are viewport CSS pixels. Frames arrive
              before request limits and stable-target delays. Keep the callback
              lightweight; errors are ignored so visualization cannot interrupt
              prefetching.
            </p>
            <p>
              An <code>IntentPrediction</code> contains <code>target</code>,{' '}
              <code>confidence</code>, <code>timeToTarget</code> in
              milliseconds, <code>point</code>, and <code>velocity</code> in CSS
              pixels per millisecond. The target contains its anchor element,
              normalized route, and rectangle.
            </p>
            <p>
              <code>onError(error, event)</code> handles adapter failures and
              throwing <code>onIntent</code> callbacks. Next.js App Router
              prefetch returns void, so network failures cannot generally be
              reported through it.
            </p>
          </>
        ),
      },
      {
        id: 'react',
        title: 'next-intent/react',
        body: (
          <>
            <Code label="Custom router">{`import { useIntent } from 'next-intent/react';

useIntent((href, { onInvalidate }) => {
  return routeCache.prefetch(href, { onInvalidate });
}, { mode: 'balanced' });`}</Code>
            <p>
              Supply your router or cache implementation. The prefetch function
              can return void or a promise. Invoke <code>onInvalidate</code>{' '}
              when its cached route becomes stale.
            </p>
          </>
        ),
      },
      {
        id: 'browser',
        title: 'next-intent/browser',
        body: (
          <>
            <Code label="Imperative observer">{`import { createIntentObserver } from 'next-intent/browser';

const observer = createIntentObserver(prefetch, { mode: 'balanced' });
observer.update({ mode: 'conservative' });
observer.invalidate('/pricing');
observer.invalidate(); // Allow every remembered route again.
observer.destroy();`}</Code>
            <p>
              <code>update</code> replaces options while preserving request
              history. The root is fixed; create a new observer to change it.
              Call <code>destroy</code> when the observed UI is removed. Avoid
              overlapping observer roots.
            </p>
          </>
        ),
      },
      {
        id: 'core',
        title: 'next-intent/core',
        body: (
          <>
            <Code label="Predict rectangular targets">{`import { predictIntent, predictionPresets } from 'next-intent/core';

const prediction = predictIntent(
  [{ x: 0, y: 50, time: 0 }, { x: 10, y: 50, time: 10 }],
  [{ id: 'details', rect: { left: 100, right: 160, top: 30, bottom: 70 } }],
  { mode: 'balanced' },
);

console.log(prediction?.target.id);`}</Code>
            <p>
              The pure core has no DOM or framework dependency. Use it for
              buttons without hrefs, canvas regions, or other rectangular
              targets. Target objects are returned unchanged. Use CSS pixels in
              one coordinate space and monotonically increasing timestamps in
              milliseconds.
            </p>
            <p>
              Exports include <code>predictIntent</code>,{' '}
              <code>predictionDefaults</code>, <code>predictionPresets</code>,
              and the core TypeScript types.
            </p>
          </>
        ),
      },
    ],
  },
  recipes: {
    title: 'Recipes & troubleshooting',
    description:
      'Connect prediction to your application and diagnose unexpected behavior.',
    sections: [
      {
        id: 'root',
        title: 'Observe one section',
        body: (
          <>
            <Code label="Scoped navigation">{`'use client';
import { useState } from 'react';
import { NextIntent, IntentLink } from 'next-intent';

export function Navigation() {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  return <nav ref={setRoot}>
    {root && <NextIntent root={root} />}
    <IntentLink href="/pricing">Pricing</IntentLink>
  </nav>;
}`}</Code>
            <p>
              Use a single observer for this subtree. A document-wide observer
              mounted elsewhere would also see these links.
            </p>
          </>
        ),
      },
      {
        id: 'custom-visuals',
        title: 'Build a prediction overlay',
        body: (
          <>
            <Code label="Live prediction callback">{`<NextIntent onPrediction={(frame) => {
  if (!frame) {
    clearOverlay();
    return;
  }
  drawPath(frame.origin, frame.projected);
  highlight(frame.prediction?.target.element ?? null);
}} />`}</Code>
            <p>
              Provide your drawing and cleanup functions. Update SVG or canvas
              through refs to avoid rerendering the whole page on every
              movement. Give overlays <code>pointer-events: none</code> so they
              do not cover links during hit testing.
            </p>
          </>
        ),
      },
      {
        id: 'no-requests',
        title: 'No prefetch requests appear',
        body: (
          <ul>
            <li>Use a production Next.js build.</li>
            <li>
              Confirm <code>NextIntent</code> is mounted and enabled.
            </li>
            <li>
              Check that the link is same-origin, visible, and not excluded by a
              filter or opt-out attribute.
            </li>
            <li>
              Check the request budget and cooldown. A prior request may already
              be cached.
            </li>
            <li>Check offline, Save-Data, or 2G connection conditions.</li>
          </ul>
        ),
      },
      {
        id: 'unexpected-requests',
        title: 'Requests happen before moving the mouse',
        body: (
          <>
            <p>
              Next.js Link normally prefetches visible routes. Use{' '}
              <code>IntentLink</code> or <code>prefetch={false}</code> to let
              intent decide. Keyboard focus and hover are also enabled by
              default; inspect <code>onIntent</code>’s reason to identify the
              trigger.
            </p>
          </>
        ),
      },
      {
        id: 'side-effects',
        title: 'Prefetch-safe routes',
        body: (
          <>
            <p>
              Keep mutations in explicit actions. A prefetched route may be
              loaded without a visit, so rendering it should not record
              purchases, change user state, or count a page view. Follow{' '}
              <a href="https://nextjs.org/docs/app/guides/prefetching#triggering-unwanted-side-effects-during-prefetching">
                Next.js’s guidance on prefetch side effects
              </a>
              .
            </p>
          </>
        ),
      },
      {
        id: 'boundaries',
        title: 'Integration boundaries',
        body: (
          <>
            <p>
              DOM discovery covers the observed document subtree. Shadow roots
              and cross-document frames need their own integration. Rewrites
              that require an internal URL different from the visible link may
              need a custom prefetch adapter.
            </p>
            <p>
              Peer ranges describe intended compatibility. The production tests
              use the pinned Next.js and React versions in the repository; they
              do not cover every version in those ranges.
            </p>
          </>
        ),
      },
    ],
  },
};

export function DocContent({ doc, path }: { doc: Doc; path: string }) {
  return (
    <>
      <StructuredData
        value={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'next-intent',
              item: siteUrl(),
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: doc.title,
              item: siteUrl(path),
            },
          ],
        }}
      />
      <h1>{doc.title}</h1>
      <p className="docs-lead">{doc.description}</p>
      <nav className="on-this-page" aria-label="On this page">
        {doc.sections.map((section) => (
          <a href={`#${section.id}`} key={section.id}>
            {section.title}
          </a>
        ))}
      </nav>
      {doc.sections.map((section) => (
        <section id={section.id} key={section.id}>
          <h2>
            <a href={`#${section.id}`}>{section.title}</a>
          </h2>
          {section.body}
        </section>
      ))}
      <footer>
        <Link href="/">Try the playground →</Link>
      </footer>
    </>
  );
}
