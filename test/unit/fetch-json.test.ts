import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson } from '../../src/source/fetch-json';
import { FakeCache, makeCtx, stubCaches } from '../helpers/fake-cache';

const ENV = {
  UPSTREAM_BASE_URL: 'https://workshop.codes',
  UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
  RENDERER_VERSION: 'v1',
  CACHE_TTL_SECONDS: '300',
};

describe('fetchJson upstream caching', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('caches successful upstream JSON and serves the next request from cache', async () => {
    stubCaches(new FakeCache());
    const { ctx, flush } = makeCtx();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchJson(ENV as never, '/wiki/articles.json', ctx as never);
    expect(first.data).toEqual({ ok: true });
    expect(first.fromCache).toBe(false);
    expect(first.upstreamUrl).toBe('https://workshop.codes/wiki/articles.json');

    await flush();

    const second = await fetchJson(ENV as never, '/wiki/articles.json', ctx as never);
    expect(second.data).toEqual({ ok: true });
    expect(second.fromCache).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches upstream 404s with a short TTL and serves them from cache', async () => {
    stubCaches(new FakeCache());
    const { ctx, flush } = makeCtx();
    const fetchMock = vi.fn(async () => new Response('not found', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchJson(ENV as never, '/wiki/articles/missing.json', ctx as never),
    ).rejects.toMatchObject({ status: 404 });

    await flush();

    await expect(
      fetchJson(ENV as never, '/wiki/articles/missing.json', ctx as never),
    ).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never caches upstream 5xx failures', async () => {
    stubCaches(new FakeCache());
    const { ctx } = makeCtx();
    const fetchMock = vi.fn(async () => new Response('boom', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchJson(ENV as never, '/wiki/articles/x.json', ctx as never),
    ).rejects.toMatchObject({ status: 500 });
    await expect(
      fetchJson(ENV as never, '/wiki/articles/x.json', ctx as never),
    ).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects oversized payloads via the Content-Length pre-check', async () => {
    const fetchMock = vi.fn(async () => {
      const res = new Response(JSON.stringify({ ok: true }), { status: 200 });
      res.headers.set('content-length', String(2_000_000));
      return res;
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchJson(ENV as never, '/wiki/articles.json')).rejects.toMatchObject({
      status: 502,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retains the hard post-read size bound', async () => {
    const big = JSON.stringify({ data: 'x'.repeat(1_000_001) });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(big, { status: 200 })));

    await expect(fetchJson(ENV as never, '/wiki/articles.json')).rejects.toMatchObject({
      status: 502,
    });
  });

  it('degrades gracefully when the Cache API is unavailable', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchJson(ENV as never, '/wiki/articles.json');
    const second = await fetchJson(ENV as never, '/wiki/articles.json');
    expect(first.data).toEqual({ ok: true });
    expect(second.data).toEqual({ ok: true });
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
