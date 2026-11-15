'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IntentLink, type IntentEvent, type PredictionMode } from 'next-intent';
import { PredictionOverlay } from './prediction-overlay';
import { predictionPresets } from 'next-intent/core';

const destinations = [
  { slug: 'atlas', name: 'Atlas' },
  { slug: 'studio', name: 'Studio' },
  { slug: 'archive', name: 'Archive' },
];
const modes = [
  {
    value: 'conservative',
    label: 'Conservative',
    description: 'Waits for a sustained approach. Fewer speculative requests.',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Prefetches as you approach a link.',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    description: 'Looks farther ahead and allows more speculative requests.',
  },
] as const;
type LogEntry = {
  href: string;
  reason: string;
  lead: string;
  beforeHover: boolean;
};

export default function Playground() {
  const [mode, setMode] = useState<PredictionMode>('balanced');
  const [enabled, setEnabled] = useState(true);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [requests, setRequests] = useState(0);
  const [session, setSession] = useState(0);
  function restart(nextMode: PredictionMode = mode) {
    setMode(nextMode);
    setEntries([]);
    setRequests(0);
    setSession((value) => value + 1);
  }
  function record(event: IntentEvent) {
    const entry = {
      href: event.href,
      reason: event.reason,
      lead: event.prediction
        ? `${Math.round(event.prediction.timeToTarget)} ms`
        : '—',
      beforeHover: !event.element.matches(':hover'),
    };
    setEntries((previous) => [entry, ...previous].slice(0, 8));
    setRequests((value) => value + 1);
  }
  const latest = entries[0];
  let status = 'No requests yet';
  if (!enabled) status = 'Prefetching paused';
  else if (latest) {
    const label = latest.href.split('/').at(-1);
    status = `${label} requested`;
    if (latest.reason === 'trajectory' && latest.beforeHover)
      status += ' before hover';
  }
  return (
    <main>
      <section className="intro">
        <h1>
          A head start
          <br />
          on your next click.
        </h1>
        <p>Predict the next link from cursor movement. Try it below.</p>
      </section>
      <div className="toolbar">
        <fieldset className="mode-control">
          <legend className="sr-only">Prefetch aggressiveness</legend>
          {modes.map(({ value, label }) => (
            <label key={value} data-selected={mode === value}>
              <input
                type="radio"
                name="mode"
                value={value}
                checked={mode === value}
                onChange={() => restart(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <button type="button" onClick={() => restart()}>
          Reset <span aria-hidden="true">↺</span>
        </button>
      </div>
      <p className="mode-description">
        {modes.find((preset) => preset.value === mode)?.description}
      </p>
      <section className="arena" aria-label="Prediction playground">
        <PredictionOverlay
          key={session}
          mode={mode}
          enabled={enabled}
          onIntent={record}
          filter={(_href, element) => element.classList.contains('card')}
        />
        <div className="launch" aria-hidden="true">
          <span className="start-point">↗</span>
          <span>Start here</span>
        </div>
        <div className="cards">
          {destinations.map(({ slug, name }) => {
            const requested = entries.some((entry) =>
              entry.href.endsWith(`/destination/${slug}`),
            );
            return (
              <IntentLink
                key={slug}
                href={`/destination/${slug}`}
                className="card"
                data-requested={requested}
              >
                <span>{name}</span>
                <span className="card-status">
                  <span className="card-prediction">Predicted</span>
                  <span className="card-request">
                    {requested ? 'Requested' : '→'}
                  </span>
                </span>
              </IntentLink>
            );
          })}
        </div>
      </section>
      <div className="prediction-legend">
        <span>
          <i className="legend-path" aria-hidden="true" />
          Projected path · {predictionPresets[mode].horizonMs} ms
        </span>
        <span>
          <i className="legend-target" aria-hidden="true" />
          Predicted target
        </span>
      </div>
      <div className="status-line">
        <p role="status">
          <span className="status-dot" data-active={Boolean(latest)} />
          {status}
        </p>
        <span>
          {requests} {requests === 1 ? 'request' : 'requests'}
        </span>
      </div>
      <details className="activity">
        <summary>Request details</summary>
        <div className="detail-toolbar">
          <label className="switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />{' '}
            Prediction enabled
          </label>
        </div>
        {entries.length === 0 ? (
          <p className="empty">
            Requests appear here as you approach, hover, or focus a link.
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Trigger</th>
                  <th>Estimated arrival</th>
                  <th>Before hover</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={`${entry.href}-${index}`}>
                    <td>{entry.href}</td>
                    <td>{entry.reason}</td>
                    <td>{entry.lead}</td>
                    <td>{entry.beforeHover ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="detail-note">
          Switching modes or resetting starts fresh intent tracking. Next.js may
          keep previously requested routes cached.
        </p>
      </details>
      <footer>
        <code>&lt;NextIntent mode="{mode}" /&gt;</code>
        <Link href="/docs">Setup guide →</Link>
      </footer>
    </main>
  );
}
