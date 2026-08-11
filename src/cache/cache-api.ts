/**
 * Thin wrapper around the Cloudflare Workers Cache API.
 *
 * Entries are keyed by synthetic `https://cache.local/...` URLs:
 * - generated responses by the canonical route cache key
 *   (pathname + accept variant + renderer version), see `http/cache-key.ts`;
 * - upstream Workshop.codes JSON subrequests by absolute upstream URL.
 *
 * The Cache API is PoP-local: entries live only in the data center that
 * served the request and are not a durable global store. TTL is driven by
 * the `Cache-Control` header written on the stored response. Writes are
 * best-effort: a failed read degrades to a miss and a failed write is
 * swallowed so caching can never break serving.
 */
const CACHE_NAME = 'workshop-md-converter';
const CACHE_ORIGIN = 'https://cache.local';

export function generatedCacheUrl(cacheKey: string): string {
  return `${CACHE_ORIGIN}/generated?key=${encodeURIComponent(cacheKey)}`;
}

export function upstreamCacheUrl(upstreamUrl: string): string {
  return `${CACHE_ORIGIN}/upstream?url=${encodeURIComponent(upstreamUrl)}`;
}

async function openCache(): Promise<Cache | undefined> {
  const storage = (globalThis as { caches?: CacheStorage }).caches;
  if (!storage) return undefined;
  try {
    return await storage.open(CACHE_NAME);
  } catch {
    return undefined;
  }
}

export async function cacheLookup(cacheUrl: string): Promise<Response | undefined> {
  const cache = await openCache();
  if (!cache) return undefined;
  try {
    return (await cache.match(new Request(cacheUrl))) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function cacheStore(cacheUrl: string, response: Response, ttlSeconds: number): Promise<void> {
  const cache = await openCache();
  if (!cache) return;

  // The canonical key already encodes the negotiated variant, so drop
  // `Vary` before storage: the Cache API matches on headers named in
  // `Vary`, and the lookup request is a synthetic key without an Accept
  // header. `Vary` is re-added when a cached response is served.
  const headers = new Headers(response.headers);
  headers.delete('vary');
  headers.set('cache-control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);

  const stored = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  try {
    await cache.put(new Request(cacheUrl), stored);
  } catch {
    // Best-effort write; never fail the request.
  }
}
