/**
 * RFC 9110 conditional request handling for generated responses.
 *
 * `maybeNotModified` returns a 304 response when the request's
 * `If-None-Match` / `If-Modified-Since` headers indicate the client already
 * holds the current representation, otherwise it returns undefined so the
 * caller serves the full response. Only 200 responses participate.
 */
export function maybeNotModified(request: Request, response: Response): Response | undefined {
  if (response.status !== 200) return undefined;

  const etag = response.headers.get('etag');
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch !== null) {
    if (etag && etagMatches(ifNoneMatch, etag)) {
      return notModifiedResponse(response);
    }
    return undefined;
  }

  const lastModified = response.headers.get('last-modified');
  const ifModifiedSince = request.headers.get('if-modified-since');
  if (lastModified && ifModifiedSince) {
    const since = Date.parse(ifModifiedSince);
    const modified = Date.parse(lastModified);
    if (Number.isFinite(since) && Number.isFinite(modified) && modified <= since) {
      return notModifiedResponse(response);
    }
  }
  return undefined;
}

function etagMatches(ifNoneMatch: string, etag: string): boolean {
  const candidates = ifNoneMatch
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (candidates.includes('*')) return true;
  const expected = normalizeEtag(etag);
  return candidates.some((candidate) => normalizeEtag(candidate) === expected);
}

function normalizeEtag(tag: string): string {
  return tag.trim().replace(/^W\//, '').replace(/^"(.*)"$/, '$1');
}

function notModifiedResponse(response: Response): Response {
  const headers = new Headers();
  const etag = response.headers.get('etag');
  const cacheControl = response.headers.get('cache-control');
  const vary = response.headers.get('vary');
  if (etag) headers.set('etag', etag);
  if (cacheControl) headers.set('cache-control', cacheControl);
  if (vary) headers.set('vary', vary);
  headers.set('x-cache-key', response.headers.get('x-cache-key') ?? '');
  headers.set('x-cache-status', response.headers.get('x-cache-status') ?? '');
  return new Response(null, { status: 304, headers });
}
