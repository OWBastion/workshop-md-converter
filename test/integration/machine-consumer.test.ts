import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../src/index';
import fixture from '../fixtures/article.sample.json';
import expectedManifest from '../fixtures/manifest.example.json';

const ENV = {
  UPSTREAM_BASE_URL: 'https://workshop.codes',
  UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
  RENDERER_VERSION: 'v1',
  CACHE_TTL_SECONDS: '300',
  PUBLIC_BASE_URL: 'https://md.example',
};

const SLUG = 'hero-color-reference-table';

function stubUpstream() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/wiki/articles.json')) {
      return new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.endsWith(`/wiki/articles/${SLUG}.json`)) {
      const articles = (fixture as { articles: Record<string, unknown>[] }).articles;
      return new Response(JSON.stringify(articles[0]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

interface ManifestEntry {
  slug: string;
  title: string;
  markdownUrl: string;
  sourceUrl: string;
  aliases: string[];
}

describe('machine-consumer contract', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('walks the full flow: manifest → exact fetch → revision metadata → conditional refetch', async () => {
    stubUpstream();

    // 1. Fetch the manifest.
    const manifestRes = await worker.fetch(new Request('https://worker.test/manifest.json'), ENV as never);
    expect(manifestRes.status).toBe(200);
    expect(manifestRes.headers.get('content-type')).toMatch(/^application\/json/);
    const manifest = JSON.parse(await manifestRes.text()) as { schemaVersion: number; documents: ManifestEntry[] };

    // 2. Select one entry by slug.
    const entry = manifest.documents.find((d) => d.slug === SLUG);
    expect(entry).toBeDefined();
    expect(entry?.markdownUrl).toBe(`https://md.example/wiki/articles/${SLUG}.md`);
    expect(entry?.sourceUrl).toBe(`https://workshop.codes/wiki/articles/${SLUG}`);
    expect(entry?.aliases).toEqual(['Hero Color Reference Table', SLUG]);

    // 3. Fetch the exact document using the manifest markdownUrl.
    const docRes = await worker.fetch(new Request(entry?.markdownUrl ?? ''), ENV as never);
    const text = await docRes.text();
    expect(docRes.status).toBe(200);
    expect(docRes.headers.get('content-type')).toContain('text/markdown');
    expect(docRes.headers.get('x-article-slug')).toBe(SLUG);

    // 4. Verify identity and revision metadata: front-matter content_hash === ETag.
    expect(text).toMatch(new RegExp(`^slug: ${SLUG}$`, 'm'));
    const contentHash = text.match(/^content_hash: ([0-9a-f]{64})$/m)?.[1];
    expect(contentHash).toBeTruthy();
    expect(docRes.headers.get('etag')).toBe(`"${contentHash}"`);

    // 5. Conditional refetch → 304 with an empty body.
    const conditional = await worker.fetch(
      new Request(entry?.markdownUrl ?? '', { headers: { 'if-none-match': docRes.headers.get('etag') ?? '' } }),
      ENV as never,
    );
    expect(conditional.status).toBe(304);
    expect(await conditional.text()).toBe('');
  });

  it('serves a manifest that matches the checked-in consumer fixture', async () => {
    stubUpstream();

    const res = await worker.fetch(new Request('https://worker.test/manifest.json'), ENV as never);
    const body = JSON.parse(await res.text());

    expect(body).toEqual(expectedManifest);
  });

  it('returns a markdown 404 for a missing document', async () => {
    stubUpstream();

    const res = await worker.fetch(
      new Request('https://md.example/wiki/articles/does-not-exist.md'),
      ENV as never,
    );
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    expect(await res.text()).toContain('# Article Not Found');
  });

  it('returns a no-store markdown error when the upstream fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));

    const res = await worker.fetch(
      new Request('https://md.example/wiki/articles/hero-color-reference-table.md'),
      ENV as never,
    );
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toContain('# Upstream Error');
  });

  it('keeps existing human-facing routes backward compatible', async () => {
    stubUpstream();

    const home = await worker.fetch(new Request('https://worker.test/'), ENV as never);
    expect(home.status).toBe(200);
    expect(await home.text()).toContain('# Workshop Markdown Converter');

    const index = await worker.fetch(new Request('https://worker.test/wiki/articles.md'), ENV as never);
    expect(index.status).toBe(200);
    expect(index.headers.get('content-type')).toContain('text/markdown');
    expect(await index.text()).toContain('# Workshop.code Wiki Articles');

    const health = await worker.fetch(new Request('https://worker.test/healthz'), ENV as never);
    expect(health.status).toBe(200);
  });

  it('supports conditional refetch of the manifest', async () => {
    stubUpstream();

    const first = await worker.fetch(new Request('https://worker.test/manifest.json'), ENV as never);
    const etag = first.headers.get('etag');
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    await first.text();

    const second = await worker.fetch(
      new Request('https://worker.test/manifest.json', { headers: { 'if-none-match': etag ?? '' } }),
      ENV as never,
    );
    expect(second.status).toBe(304);
    expect(await second.text()).toBe('');
  });
});
