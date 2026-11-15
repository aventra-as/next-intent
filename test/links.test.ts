import { afterEach, describe, expect, it } from 'vitest';
import { getLinkHref } from '../src/links.js';

function link(href: string) {
  const anchor = document.createElement('a');
  anchor.setAttribute('href', href);
  document.body.append(anchor);
  return anchor;
}
afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  history.replaceState(null, '', '/');
});

describe('link eligibility', () => {
  it.each([
    ['/pricing', '/pricing'],
    ['pricing', '/pricing'],
    ['/a?q=1#details', '/a?q=1'],
    ['https://example.com/about', '/about'],
    ['//example.com/a', '/a'],
    ['  /about  ', '/about'],
    ['/?search=hello', '/?search=hello'],
    ['/hello%20world', '/hello%20world'],
  ])('normalizes %s', (input, expected) =>
    expect(getLinkHref(link(input), location)).toBe(expected),
  );
  it.each([
    '',
    '   ',
    '#section',
    '/',
    '/#section',
    'javascript:alert(1)',
    'mailto:a@example.com',
    'tel:123',
    'data:text/html,x',
    'ftp://example.com/a',
    'https://elsewhere.com/a',
    '//elsewhere.com/a',
    'http://example.com/a',
    'https://user:pass@example.com/a',
    'https://example.com:8443/a',
    'http://[',
    'https://example.com//elsewhere.com/a',
  ])('excludes %s', (href) =>
    expect(getLinkHref(link(href), location)).toBeNull(),
  );
  it('rejects a disconnected anchor', () => {
    const a = link('/a');
    a.remove();
    expect(getLinkHref(a, location)).toBeNull();
  });
  it('rejects an anchor without href', () => {
    const a = link('/a');
    a.removeAttribute('href');
    expect(getLinkHref(a, location)).toBeNull();
  });
  it.each(['_blank', '_parent', '_top', 'window'])(
    'excludes target %s',
    (target) => {
      const a = link('/a');
      a.target = target;
      expect(getLinkHref(a, location)).toBeNull();
    },
  );
  it.each(['_self', '_SELF', ''])('accepts target %s', (target) => {
    const a = link('/a');
    a.target = target;
    expect(getLinkHref(a, location)).toBe('/a');
  });
  it.each(['download', 'hidden', 'inert'])(
    'excludes attribute %s',
    (attribute) => {
      const a = link('/a');
      a.setAttribute(attribute, '');
      expect(getLinkHref(a, location)).toBeNull();
    },
  );
  it.each([
    ['data-next-intent', 'off'],
    ['aria-disabled', 'true'],
  ])('excludes %s=%s', (key, value) => {
    const a = link('/a');
    a.setAttribute(key, value);
    expect(getLinkHref(a, location)).toBeNull();
  });
  it('honors ancestor opt-out', () => {
    const a = link('/a');
    const parent = document.createElement('div');
    parent.dataset.nextIntent = 'off';
    a.replaceWith(parent);
    parent.append(a);
    expect(getLinkHref(a, location)).toBeNull();
  });
  it.each(['external', 'nofollow external', 'EXTERNAL'])(
    'excludes rel=%s',
    (rel) => {
      const a = link('/a');
      a.rel = rel;
      expect(getLinkHref(a, location)).toBeNull();
    },
  );
  it('allows noreferrer and nofollow', () => {
    const a = link('/a');
    a.rel = 'noreferrer nofollow';
    expect(getLinkHref(a, location)).toBe('/a');
  });
  it('uses the document base URI', () => {
    document.head.innerHTML = '<base href="https://example.com/docs/">';
    expect(getLinkHref(link('guide'), location)).toBe('/docs/guide');
  });
  it('checks current query strings when skipping self links', () => {
    history.replaceState(null, '', '/search?q=1');
    expect(getLinkHref(link('/search?q=1#x'), location)).toBeNull();
    expect(getLinkHref(link('/search?q=2'), location)).toBe('/search?q=2');
  });
});
