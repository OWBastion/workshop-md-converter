import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../src/index';
import fixture from '../fixtures/article.sample.json';
import { FakeCache, makeCtx, stubCaches } from '../helpers/fake-cache';

const ENV = {
  UPSTREAM_BASE_URL: 'https://workshop.codes',
  UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
  RENDERER_VERSION: 'v1',
  CACHE_TTL_SECONDS: '300',
  PUBLIC_BASE_URL: 'https://md.example',
};

function stubListFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/wiki/articles.json')) {
      return new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('manifest route integration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('serves a generated manifest from the article list fixture', async () => {
    stubListFetch();

    const res = await worker.fetch(new Request('https://worker.test/manifest.json'), ENV as never);
    const text = await res.text();
    const body = JSON.parse(text) as {
      schemaVersion: number;
      documents: Array<{ markdownUrl: string; sourceUrl: string }>;
    };

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    expect(body.schemaVersion).toBe(1);
    expect(body.documents.length).toBeGreaterThan(0);
    for (const doc of body.documents) {
      expect(doc.markdownUrl).toMatch(/\/wiki\/articles\/[^/]+\.md$/);
      expect(doc.sourceUrl).toContain('workshop.codes');
    }
  });

  it('sets cache, etag, and source metadata headers', async () => {
    stubListFetch();

    const res = await worker.fetch(new Request('https://worker.test/manifest.json'), ENV as never);
    await res.text();

    expect(res.headers.get('cache-control')).toContain('max-age=300');
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');
    expect(res.headers.get('etag')).toMatch(/^"[0-9a-f]{64}"$/);
    expect(res.headers.get('x-agent-content-type')).toBe('wiki-manifest');
    expect(res.headers.get('x-source-format')).toBe('workshop-json');
    expect(res.headers.get('x-upstream-url')).toBe('https://workshop.codes/wiki/articles.json');
    expect(res.headers.get('x-upstream-cache')).toBe('MISS');
    expect(Number(res.headers.get('x-upstream-bytes'))).toBeGreaterThan(0);
    expect(res.headers.get('vary')).toBeNull();
  });

  it('serves repeated manifest requests from the generated response cache', async () => {
    stubCaches(new FakeCache());
    const { ctx, flush } = makeCtx();
    const fetchMock = stubListFetch();

    const first = await worker.fetch(
      new Request('https://worker.test/manifest.json'),
      ENV as never,
      ctx as never,
    );
    expect(first.headers.get('x-cache-status')).toBe('MISS');
    expect(first.headers.get('x-upstream-cache')).toBe('MISS');
    const firstText = await first.text();

    await flush();

    const second = await worker.fetch(
      new Request('https://worker.test/manifest.json'),
      ENV as never,
      ctx as never,
    );
    expect(second.headers.get('x-cache-status')).toBe('HIT');
    const secondText = await second.text();
    expect(secondText).toBe(firstText);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns 304 with an empty body when If-None-Match matches', async () => {
    stubListFetch();

    const first = await worker.fetch(new Request('https://worker.test/manifest.json'), ENV as never);
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();
    await first.text();

    const res = await worker.fetch(
      new Request('https://worker.test/manifest.json', {
        headers: { 'if-none-match': etag ?? '' },
      }),
      ENV as never,
    );
    expect(res.status).toBe(304);
    expect(res.headers.get('etag')).toBe(etag);
    expect(await res.text()).toBe('');
  });

  it('returns 502 with no-store when the upstream list fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));

    const res = await worker.fetch(new Request('https://worker.test/manifest.json'), ENV as never);
    const text = await res.text();
    const body = JSON.parse(text) as { error: { status: number; title: string; message: string } };

    expect(res.status).toBe(502);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    expect(body.error.status).toBe(502);
    expect(body.error.title).toBe('Upstream Error');
  });

  it('does not leak article body content into the manifest', async () => {
    stubListFetch();

    const res = await worker.fetch(new Request('https://worker.test/manifest.json'), ENV as never);
    const text = await res.text();

    expect(text).not.toContain('<script');
    expect(text).not.toContain('alert(1)');
    expect(text).not.toContain("console.log('ok')");
  });

  it('generates the manifest instead of passing through raw upstream JSON', async () => {
    stubListFetch();

    const res = await worker.fetch(new Request('https://worker.test/manifest.json'), ENV as never);
    const text = await res.text();
    const body = JSON.parse(text) as Record<string, unknown>;

    expect(body).toHaveProperty('schemaVersion');
    expect(body).toHaveProperty('documents');
    expect(text).not.toBe(JSON.stringify(fixture));
  });
});
