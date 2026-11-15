'use client';

import { useState } from 'react';
import {
  IntentLink,
  NextIntent,
  type IntentEvent,
  type PredictionMode,
} from 'next-intent';

const destinations = [
  { slug: 'atlas', name: 'Atlas', detail: 'Maps & places', color: 'violet' },
  {
    slug: 'studio',
    name: 'Studio',
    detail: 'Ideas & experiments',
    color: 'green',
  },
  {
    slug: 'archive',
    name: 'Archive',
    detail: 'Notes & collections',
    color: 'orange',
  },
];
type LogEntry = {
  href: string;
  reason: string;
  score: string;
  lead: string;
  beforeHover: boolean;
};

export default function Playground() {
  const [mode, setMode] = useState<PredictionMode>('smart');
  const [enabled, setEnabled] = useState(true);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [run, setRun] = useState(0);
  function record(event: IntentEvent) {
    const entry = {
      href: event.href,
      reason: event.reason,
      score: event.prediction
        ? `${Math.round(event.prediction.confidence * 100)} / 100`
        : '—',
      lead: event.prediction
        ? `${Math.round(event.prediction.timeToTarget)} ms`
        : '—',
      beforeHover: !event.element.matches(':hover'),
    };
    setEntries((previous) => [entry, ...previous].slice(0, 8));
  }
  return (
    <main>
      <NextIntent key={run} mode={mode} enabled={enabled} onIntent={record} />
      <header>
        <a
          className="wordmark"
          href="https://github.com/hypervisor/next-intent"
        >
          next-intent <span>↗</span>
        </a>
        <label className="switch">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />{' '}
          Prediction enabled
        </label>
      </header>
      <section className="intro">
        <h1>
          A head start
          <br />
          on your next click.
        </h1>
        <p>
          Move toward a card. Watch its route get requested before your cursor
          arrives.
        </p>
      </section>
      <div className="toolbar">
        <fieldset>
          <legend>Prediction mode</legend>
          {(['simple', 'smart'] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="mode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
              />
              {value === 'smart' ? 'Smart' : 'Simple'}
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          onClick={() => {
            setEntries([]);
            setRun((value) => value + 1);
          }}
        >
          Reset session ↺
        </button>
      </div>
      <section className="arena" aria-label="Prediction playground">
        <div className="launch">
          <span className="start-dot" />
          <span>Start here</span>
          <span className="direction">Move toward a card →</span>
        </div>
        <div className="cards">
          {destinations.map(({ slug, name, detail, color }) => {
            const requested = entries.some((entry) =>
              entry.href.endsWith(`/destination/${slug}`),
            );
            return (
              <IntentLink
                key={slug}
                href={`/destination/${slug}`}
                className={`card ${color}`}
                data-requested={requested}
              >
                <div>
                  <h2>{name}</h2>
                  <p>{detail}</p>
                </div>
                <span className="card-status">
                  {requested ? 'Prefetch requested' : '→'}
                </span>
              </IntentLink>
            );
          })}
        </div>
      </section>
      <section className="activity" aria-label="Prefetch activity">
        <div className="activity-heading">
          <h2>Prefetch activity</h2>
          <span>{entries.length} requests</span>
        </div>
        {entries.length === 0 ? (
          <p className="empty" role="status">
            Waiting for intent. Try moving steadily toward Atlas.
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Trigger</th>
                  <th>Score</th>
                  <th>Estimated arrival</th>
                  <th>Before hover</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={`${entry.href}-${index}`}>
                    <td>{entry.href}</td>
                    <td>{entry.reason}</td>
                    <td>{entry.score}</td>
                    <td>{entry.lead}</td>
                    <td>{entry.beforeHover ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <footer>
        Requests are deduplicated for 30 seconds. Reset starts a new prediction
        session; Next.js may still have the route cached.
      </footer>
    </main>
  );
}
