import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../src/index';
import fixture from '../fixtures/article.sample.json';
import expectedMarkdown from '../fixtures/article.expected.md?raw';
import { FakeCache, makeCtx, stubCaches } from '../helpers/fake-cache';

describe('render article integration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders root onboarding guide as markdown without upstream fetch', async () => {
    const fetchMock = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const req = new Request('https://worker.test/', {
      headers: { accept: 'text/html' },
    });

    const env = {
      UPSTREAM_BASE_URL: 'https://workshop.codes',
      UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
      RENDERER_VERSION: 'v1',
      CACHE_TTL_SECONDS: '300',
    };

    const res = await worker.fetch(req, env as never);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    expect(res.headers.get('cache-control')).toContain('max-age=300');
    expect(res.headers.get('vary')).toContain('Accept');
    expect(Number(res.headers.get('x-markdown-tokens'))).toBeGreaterThan(0);
    expect(text).toContain('title: Workshop Markdown Converter Guide');
    expect(text).toContain('# Workshop Markdown Converter');
    expect(text).toContain('Start here: `/wiki/articles.md`');
    expect(text).toContain('curl https://md.owbastion.codes/wiki/articles.md');
    expect(text).toContain('Accept: text/markdown');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns markdown 406 for article route without .md when markdown is not accepted', async () => {
    const fetchMock = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const req = new Request('https://worker.test/wiki/articles/hero-color-reference-table', {
      headers: { accept: 'text/html' },
    });

    const env = {
      UPSTREAM_BASE_URL: 'https://workshop.codes',
      UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
      RENDERER_VERSION: 'v1',
      CACHE_TTL_SECONDS: '300',
    };

    const res = await worker.fetch(req, env as never);
    const text = await res.text();

    expect(res.status).toBe(406);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    expect(text).toContain('title: Not Acceptable');
    expect(text).toContain('# Not Acceptable');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns markdown 406 for index route without .md when markdown is not accepted', async () => {
    const fetchMock = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const req = new Request('https://worker.test/wiki/articles', {
      headers: { accept: 'text/html' },
    });

    const env = {
      UPSTREAM_BASE_URL: 'https://workshop.codes',
      UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
      RENDERER_VERSION: 'v1',
      CACHE_TTL_SECONDS: '300',
    };

    const res = await worker.fetch(req, env as never);
    const text = await res.text();

    expect(res.status).toBe(406);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    expect(text).toContain('title: Not Acceptable');
    expect(text).toContain('# Not Acceptable');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders article markdown with PUBLIC_BASE_URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/wiki/articles.json')) {
          return new Response(JSON.stringify(fixture), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response('not found', { status: 404 });
      }),
    );

    const req = new Request('https://worker.test/wiki/articles/hero-color-reference-table.md', {
      headers: { accept: 'text/markdown' },
    });

    const env = {
      UPSTREAM_BASE_URL: 'https://workshop.codes',
      UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
      RENDERER_VERSION: 'v1',
      CACHE_TTL_SECONDS: '300',
      PUBLIC_BASE_URL: 'https://md.example',
    };

    const res = await worker.fetch(req, env as never);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    expect(res.headers.get('vary')).toContain('Accept');
    expect(text).toBe(expectedMarkdown);
    expect(text).toContain('```ts\nconsole.log(\'ok\')\n```');
    expect(text).toContain('<table><tr><td>A</td></tr></table>');
    expect(text).not.toContain('> Notice:');
    expect(text).not.toContain('<script');
  });

  it('returns markdown 404 for unknown slug article request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/wiki/articles.json')) {
          return new Response(JSON.stringify(fixture), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response('not found', { status: 404 });
      }),
    );

    const req = new Request('https://worker.test/wiki/articles/unknown-article.md', {
      headers: { accept: 'text/markdown' },
    });

    const env = {
      UPSTREAM_BASE_URL: 'https://workshop.codes',
      UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
      RENDERER_VERSION: 'v1',
      CACHE_TTL_SECONDS: '300',
      PUBLIC_BASE_URL: 'https://md.example',
    };

    const res = await worker.fetch(req, env as never);
    const text = await res.text();

    expect(res.status).toBe(404);
    expect(text).toContain('title: Article Not Found');
    expect(text).toContain('# Article Not Found');
  });

  it('uses single article json first on .md route without requesting list', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/wiki/articles/how-to-use-loops.json')) {
        return new Response(
          JSON.stringify({
            id: 4841,
            title: 'How To Use Loops',
            content: '# Loop Guide\n\nUse waits in loops.',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = new Request('https://worker.test/wiki/articles/how-to-use-loops.md', {
      headers: { accept: 'text/markdown' },
    });

    const env = {
      UPSTREAM_BASE_URL: 'https://workshop.codes',
      UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
      RENDERER_VERSION: 'v1',
      CACHE_TTL_SECONDS: '300',
      PUBLIC_BASE_URL: 'https://md.example',
    };

    const res = await worker.fetch(req, env as never);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    expect(res.headers.get('x-upstream-url')).toBe('https://workshop.codes/wiki/articles/how-to-use-loops.json');
    expect(text).toContain('slug: how-to-use-loops');
    expect(text).toContain('# Loop Guide');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://workshop.codes/wiki/articles/how-to-use-loops.json');
  });

  it('falls back to list when single article json returns 404 on negotiated route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/wiki/articles/how-to-use-loops.json')) {
          return new Response('not found', { status: 404 });
        }
        if (url.endsWith('/wiki/articles.json')) {
          return new Response(
            JSON.stringify([
              {
                slug: 'how-to-use-loops',
                title: 'How To Use Loops',
                content: '# Loop Guide\n\nUse waits in loops.',
              },
            ]),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          );
        }
        return new Response('not found', { status: 404 });
      }),
    );

    const req = new Request('https://worker.test/wiki/articles/how-to-use-loops', {
      headers: { accept: 'text/markdown, text/html' },
    });

    const env = {
      UPSTREAM_BASE_URL: 'https://workshop.codes',
      UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
      RENDERER_VERSION: 'v1',
      CACHE_TTL_SECONDS: '300',
      PUBLIC_BASE_URL: 'https://md.example',
    };

    const res = await worker.fetch(req, env as never);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    expect(res.headers.get('x-upstream-url')).toBe('https://workshop.codes/wiki/articles.json');
    expect(text).toContain('slug: how-to-use-loops');
    expect(text).toContain('# Loop Guide');
  });

  it('returns markdown 502 when single article upstream fetch fails and does not retry list', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/wiki/articles/how-to-use-loops.json')) {
        throw new Error('network down');
      }
      if (url.endsWith('/wiki/articles.json')) {
        return new Response(JSON.stringify(fixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = new Request('https://worker.test/wiki/articles/how-to-use-loops.md', {
      headers: { accept: 'text/markdown' },
    });

    const env = {
      UPSTREAM_BASE_URL: 'https://workshop.codes',
      UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
      RENDERER_VERSION: 'v1',
      CACHE_TTL_SECONDS: '300',
      PUBLIC_BASE_URL: 'https://md.example',
    };

    const res = await worker.fetch(req, env as never);
    const text = await res.text();

    expect(res.status).toBe(502);
    expect(text).toContain('title: Upstream Error');
    expect(text).toContain('Failed to fetch upstream JSON');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://workshop.codes/wiki/articles/how-to-use-loops.json');
  });

  it('falls back to request origin when PUBLIC_BASE_URL is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/wiki/articles.json')) {
          return new Response(JSON.stringify(fixture), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response('not found', { status: 404 });
      }),
    );

    const req = new Request('https://worker.test/wiki/articles/hero-color-reference-table', {
      headers: { accept: 'text/markdown, text/html' },
    });

    const env = {
      UPSTREAM_BASE_URL: 'https://workshop.codes',
      UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
      RENDERER_VERSION: 'v1',
      CACHE_TTL_SECONDS: '300',
    };

    const res = await worker.fetch(req, env as never);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    expect(text).toContain('url: https://worker.test/wiki/articles/hero-color-reference-table.md');
  });

  it('serves repeated article requests from the generated response cache', async () => {
    stubCaches(new FakeCache());
    const { ctx, flush } = makeCtx();

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/wiki/articles/how-to-use-loops.json')) {
        return new Response(
          JSON.stringify({ id: 4841, title: 'How To Use Loops', content: '# Loop Guide' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const env = {
      UPSTREAM_BASE_URL: 'https://workshop.codes',
      UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
      RENDERER_VERSION: 'v1',
      CACHE_TTL_SECONDS: '300',
      PUBLIC_BASE_URL: 'https://md.example',
    };

    const first = await worker.fetch(
      new Request('https://worker.test/wiki/articles/how-to-use-loops.md'),
      env as never,
      ctx as never,
    );
    expect(first.status).toBe(200);
    expect(first.headers.get('x-cache-status')).toBe('MISS');
    expect(first.headers.get('x-upstream-cache')).toBe('MISS');
    const firstText = await first.text();

    await flush();

    const second = await worker.fetch(
      new Request('https://worker.test/wiki/articles/how-to-use-loops.md'),
      env as never,
      ctx as never,
    );
    expect(second.status).toBe(200);
    expect(second.headers.get('x-cache-status')).toBe('HIT');
    expect(second.headers.get('vary')).toContain('Accept');
    const secondText = await second.text();
    expect(secondText).toBe(firstText);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves the cached article index without re-fetching upstream', async () => {
    stubCaches(new FakeCache());
    const { ctx, flush } = makeCtx();

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const env = {
      UPSTREAM_BASE_URL: 'https://workshop.codes',
      UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
      RENDERER_VERSION: 'v1',
      CACHE_TTL_SECONDS: '300',
      PUBLIC_BASE_URL: 'https://md.example',
    };

    const first = await worker.fetch(
      new Request('https://worker.test/wiki/articles.md'),
      env as never,
      ctx as never,
    );
    expect(first.headers.get('x-cache-status')).toBe('MISS');
    await first.text();
    await flush();

    const second = await worker.fetch(
      new Request('https://worker.test/wiki/articles.md'),
      env as never,
      ctx as never,
    );
    expect(second.headers.get('x-cache-status')).toBe('HIT');
    await second.text();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches generated 404 markdown with a short TTL', async () => {
    stubCaches(new FakeCache());
    const { ctx, flush } = makeCtx();

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

    const env = {
      UPSTREAM_BASE_URL: 'https://workshop.codes',
      UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
      RENDERER_VERSION: 'v1',
      CACHE_TTL_SECONDS: '300',
      PUBLIC_BASE_URL: 'https://md.example',
    };

    const first = await worker.fetch(
      new Request('https://worker.test/wiki/articles/unknown-article.md'),
      env as never,
      ctx as never,
    );
    expect(first.status).toBe(404);
    expect(first.headers.get('x-cache-status')).toBe('MISS');
    expect(first.headers.get('cache-control')).toContain('max-age=60');
    await first.text();
    await flush();

    const second = await worker.fetch(
      new Request('https://worker.test/wiki/articles/unknown-article.md'),
      env as never,
      ctx as never,
    );
    expect(second.status).toBe(404);
    expect(second.headers.get('x-cache-status')).toBe('HIT');
    await second.text();
    // First request: single-article 404 + list fallback. Second request: cache only.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never caches upstream 5xx failures', async () => {
    stubCaches(new FakeCache());
    const { ctx } = makeCtx();

    const fetchMock = vi.fn(async () => new Response('boom', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const env = {
      UPSTREAM_BASE_URL: 'https://workshop.codes',
      UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
      RENDERER_VERSION: 'v1',
      CACHE_TTL_SECONDS: '300',
      PUBLIC_BASE_URL: 'https://md.example',
    };

    const first = await worker.fetch(
      new Request('https://worker.test/wiki/articles/how-to-use-loops.md'),
      env as never,
      ctx as never,
    );
    expect(first.status).toBe(500);
    expect(first.headers.get('cache-control')).toBe('no-store');
    await first.text();

    const second = await worker.fetch(
      new Request('https://worker.test/wiki/articles/how-to-use-loops.md'),
      env as never,
      ctx as never,
    );
    expect(second.status).toBe(500);
    expect(second.headers.get('cache-control')).toBe('no-store');
    await second.text();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
