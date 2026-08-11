import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheLookup, cacheStore, generatedCacheUrl, upstreamCacheUrl } from '../../src/cache/cache-api';
import { FakeCache, stubCaches } from '../helpers/fake-cache';

describe('cache-api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('builds stable, namespaced key URLs', () => {
    expect(generatedCacheUrl('a::b::v1')).toBe(generatedCacheUrl('a::b::v1'));
    expect(generatedCacheUrl('a::b::v1')).not.toBe(generatedCacheUrl('a::b::v2'));
    expect(generatedCacheUrl('a')).not.toBe(upstreamCacheUrl('https://workshop.codes/a'));
    expect(upstreamCacheUrl('https://workshop.codes/a')).not.toBe(upstreamCacheUrl('https://workshop.codes/b'));
    expect(upstreamCacheUrl('https://workshop.codes/a')).toBe(
      upstreamCacheUrl('https://workshop.codes/a'),
    );
  });

  it('round-trips a response through the cache, stripping Vary and applying the TTL', async () => {
    stubCaches(new FakeCache());

    const key = generatedCacheUrl('/wiki/articles/a.md::markdown::v1');
    await cacheStore(
      key,
      new Response('# hello', {
        status: 200,
        headers: { 'content-type': 'text/markdown', vary: 'Accept', etag: '"abc"' },
      }),
      300,
    );

    const hit = await cacheLookup(key);
    expect(hit).toBeDefined();
    expect(hit?.status).toBe(200);
    expect(await hit?.text()).toBe('# hello');
    expect(hit?.headers.get('vary')).toBeNull();
    expect(hit?.headers.get('cache-control')).toBe('public, max-age=300, s-maxage=300');
    expect(hit?.headers.get('etag')).toBe('"abc"');
  });

  it('returns undefined for a cache miss', async () => {
    stubCaches(new FakeCache());
    expect(await cacheLookup(generatedCacheUrl('missing'))).toBeUndefined();
  });

  it('preserves non-200 statuses (404 short-TTL entries)', async () => {
    stubCaches(new FakeCache());

    const key = upstreamCacheUrl('https://workshop.codes/wiki/articles/missing.json');
    await cacheStore(key, new Response('', { status: 404 }), 60);

    const hit = await cacheLookup(key);
    expect(hit?.status).toBe(404);
    expect(hit?.headers.get('cache-control')).toBe('public, max-age=60, s-maxage=60');
  });

  it('degrades to a miss and a no-op write when the Cache API is unavailable', async () => {
    expect(await cacheLookup(generatedCacheUrl('x'))).toBeUndefined();
    await expect(
      cacheStore(generatedCacheUrl('x'), new Response('y', { status: 200 }), 300),
    ).resolves.toBeUndefined();
  });
});
