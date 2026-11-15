'use client';
import { useState } from 'react';

export function CopyCode({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState('Copy');
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied');
    } catch {
      setStatus('Select text to copy');
    }
  }
  return (
    <>
      <button type="button" onClick={copy} aria-label={`Copy ${label}`}>
        {status}
      </button>
      <span className="sr-only" role="status">
        {status === 'Copy' ? '' : status}
      </span>
    </>
  );
}
