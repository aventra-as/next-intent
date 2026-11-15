/** Pages Router expects paths without the configured basePath. */
export function stripBasePath(href: string, basePath: string): string {
  const pathname = href.split('?')[0]!;
  if (
    !basePath ||
    (pathname !== basePath && !pathname.startsWith(basePath + '/'))
  )
    return href;
  const stripped = href.slice(basePath.length);
  if (!stripped || stripped.startsWith('?')) return '/' + stripped;
  return stripped;
}

/** Resolve a DOM href to a same-origin route, preserving query strings. */
export function getLinkHref(
  element: HTMLAnchorElement,
  location: Location,
): string | null {
  if (
    !element.isConnected ||
    element.closest(
      '[data-next-intent="off"], [inert], [hidden], [aria-disabled="true"]',
    )
  )
    return null;
  if (element.hasAttribute('download')) return null;
  const target = element.getAttribute('target')?.toLowerCase();
  if (target && target !== '_self') return null;
  if (
    element.rel.split(/\s+/).some((value) => value.toLowerCase() === 'external')
  )
    return null;
  const raw = element.getAttribute('href')?.trim();
  if (!raw || raw.startsWith('#')) return null;
  let url: URL;
  try {
    url = new URL(raw, element.baseURI);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.origin !== location.origin || url.username || url.password)
    return null;
  const href = url.pathname + url.search;
  if (href === location.pathname + location.search) return null;
  // A same-origin URL with a // pathname becomes external when passed to a router.
  if (href.startsWith('//') || href.includes('\\')) return null;
  return href;
}
