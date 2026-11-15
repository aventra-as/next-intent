import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import {
  StrictMode,
  createRef,
  forwardRef,
  type ComponentPropsWithoutRef,
} from 'react';
import { NextIntent, IntentLink, useNextIntent } from '../src/index.js';
import { NextIntent as PagesIntent } from '../src/pages.js';
import { useIntent } from '../src/react.js';
import type { IntentOptions, Prefetch } from '../src/types.js';
import { stripBasePath } from '../src/links.js';

const mocks = vi.hoisted(() => ({
  app: vi.fn(),
  pages: vi.fn(),
  basePath: '',
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ prefetch: mocks.app }),
}));
vi.mock('next/router', () => ({
  useRouter: () => ({ prefetch: mocks.pages, basePath: mocks.basePath }),
}));
vi.mock('next/link', () => ({
  default: forwardRef<
    HTMLAnchorElement,
    ComponentPropsWithoutRef<'a'> & { prefetch?: boolean }
  >(function Link({ prefetch, ...props }, ref) {
    return <a {...props} ref={ref} data-prefetch={String(prefetch)} />;
  }),
}));
afterEach(() => {
  cleanup();
  mocks.basePath = '';
});

function Consumer({
  prefetch,
  ...options
}: IntentOptions & { prefetch: Prefetch }) {
  useIntent(prefetch, options);
  return <a href="/a">Go</a>;
}
function HookConsumer() {
  useNextIntent();
  return <a href="/a">Go</a>;
}

describe('React adapters', () => {
  it('renders children without an extra DOM wrapper', () => {
    const view = render(
      <NextIntent>
        <a href="/a">Go</a>
      </NextIntent>,
    );
    expect(view.container.innerHTML).toBe('<a href="/a">Go</a>');
    fireEvent.focusIn(view.getByText('Go'));
    expect(mocks.app.mock.calls[0]![0]).toBe('https://example.com/a');
  });
  it('supports mounting without children', () => {
    expect(render(<NextIntent />).container.innerHTML).toBe('');
  });
  it('exports a standalone App Router hook', () => {
    const view = render(<HookConsumer />);
    fireEvent.focusIn(view.getByText('Go'));
    expect(mocks.app).toHaveBeenCalledOnce();
  });
  it('passes invalidation and prefetch kind to the App Router', () => {
    const view = render(
      <NextIntent>
        <a href="/a">Go</a>
      </NextIntent>,
    );
    fireEvent.focusIn(view.getByText('Go'));
    expect(mocks.app.mock.calls[0]![1]).toMatchObject({
      kind: 'full',
      onInvalidate: expect.any(Function),
    });
    mocks.app.mock.calls[0]![1].onInvalidate();
    fireEvent.focusIn(view.getByText('Go'));
    expect(mocks.app).toHaveBeenCalledTimes(2);
  });
  it('preserves basePath in an absolute App Router URL', () => {
    const view = render(
      <NextIntent>
        <a href="/docs/a">Go</a>
      </NextIntent>,
    );
    fireEvent.focusIn(view.getByText('Go'));
    expect(mocks.app.mock.calls[0]![0]).toBe('https://example.com/docs/a');
  });
  it('works with Pages Router', () => {
    const view = render(
      <PagesIntent>
        <a href="/a">Go</a>
      </PagesIntent>,
    );
    fireEvent.focusIn(view.getByText('Go'));
    expect(mocks.pages).toHaveBeenCalledWith('/a', undefined, {
      locale: false,
    });
  });
  it('supports a childless Pages Router component', () =>
    expect(render(<PagesIntent />).container.innerHTML).toBe(''));
  it('removes Pages Router basePath while retaining locale and search', () => {
    mocks.basePath = '/docs';
    const view = render(
      <PagesIntent>
        <a href="/docs/nb/a?x=1">Go</a>
      </PagesIntent>,
    );
    fireEvent.focusIn(view.getByText('Go'));
    expect(mocks.pages).toHaveBeenCalledWith('/nb/a?x=1', undefined, {
      locale: false,
    });
  });
  it('uses the latest callback without resetting request history', () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = render(<Consumer prefetch={first} />);
    fireEvent.focusIn(view.getByText('Go'));
    view.rerender(<Consumer prefetch={second} />);
    fireEvent.focusIn(view.getByText('Go'));
    expect(second).not.toHaveBeenCalled();
    view.getByText('Go').setAttribute('href', '/b');
    fireEvent.focusIn(view.getByText('Go'));
    expect(second).toHaveBeenCalledWith('/b', expect.any(Object));
  });
  it('applies options after rerender', () => {
    const prefetch = vi.fn();
    const view = render(<Consumer prefetch={prefetch} enabled={false} />);
    fireEvent.focusIn(view.getByText('Go'));
    expect(prefetch).not.toHaveBeenCalled();
    view.rerender(<Consumer prefetch={prefetch} />);
    fireEvent.focusIn(view.getByText('Go'));
    expect(prefetch).toHaveBeenCalledOnce();
  });
  it('survives Strict Mode effect replay without duplicate requests', () => {
    const prefetch = vi.fn();
    const view = render(
      <StrictMode>
        <Consumer prefetch={prefetch} />
      </StrictMode>,
    );
    fireEvent.focusIn(view.getByText('Go'));
    expect(prefetch).toHaveBeenCalledOnce();
  });
  it('removes the observer on unmount', () => {
    const prefetch = vi.fn();
    const view = render(<Consumer prefetch={prefetch} />);
    view.unmount();
    const a = document.createElement('a');
    a.href = '/b';
    document.body.append(a);
    fireEvent.focusIn(a);
    expect(prefetch).not.toHaveBeenCalled();
    a.remove();
  });
  it('changes the observed root', () => {
    const one = document.createElement('section');
    const two = document.createElement('section');
    document.body.append(one, two);
    const a = document.createElement('a');
    a.href = '/b';
    one.append(a);
    const prefetch = vi.fn();
    const view = render(<Consumer prefetch={prefetch} root={one} />);
    view.rerender(<Consumer prefetch={prefetch} root={two} />);
    fireEvent.focusIn(a);
    expect(prefetch).not.toHaveBeenCalled();
    two.append(a);
    fireEvent.focusIn(a);
    expect(prefetch).toHaveBeenCalledOnce();
    one.remove();
    two.remove();
  });
  it('IntentLink preserves href, ref, handlers, and defaults prefetch to false', () => {
    const ref = createRef<HTMLAnchorElement>();
    const onClick = vi.fn((event) => event.preventDefault());
    const view = render(
      <IntentLink href="/a" ref={ref} onClick={onClick} aria-label="Open">
        Go
      </IntentLink>,
    );
    expect(ref.current).toBe(view.getByText('Go'));
    expect(ref.current?.getAttribute('data-prefetch')).toBe('false');
    fireEvent.click(view.getByText('Go'));
    expect(onClick).toHaveBeenCalledOnce();
  });
  it('IntentLink allows explicit prefetch behavior', () => {
    const view = render(
      <IntentLink href="/a" prefetch>
        Go
      </IntentLink>,
    );
    expect(view.getByText('Go').getAttribute('data-prefetch')).toBe('true');
  });
});

describe('Pages Router path normalization', () => {
  it.each([
    ['/docs/a', '/docs', '/a'],
    ['/docs', '/docs', '/'],
    ['/docs?q=1', '/docs', '/?q=1'],
    ['/docs2/a', '/docs', '/docs2/a'],
    ['/a', '', '/a'],
    ['/docs/a?q=1', '/docs', '/a?q=1'],
  ])('normalizes %s with basePath %s', (href, basePath, expected) =>
    expect(stripBasePath(href, basePath)).toBe(expected),
  );
});
