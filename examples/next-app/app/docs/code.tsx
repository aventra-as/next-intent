'use client';
import { useState } from 'react';

export function Code({
  children,
  label,
}: {
  children: string;
  label?: string;
}) {
  const [status, setStatus] = useState('Copy');
  async function copy() {
    try {
      await navigator.clipboard.writeText(children);
      setStatus('Copied');
    } catch {
      setStatus('Select text to copy');
    }
  }
  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span>{label}</span>
        <button
          type="button"
          onClick={copy}
          aria-label={label ? `Copy ${label}` : 'Copy code'}
        >
          {status}
        </button>
        <span className="sr-only" role="status">
          {status === 'Copy' ? '' : status}
        </span>
      </div>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}
