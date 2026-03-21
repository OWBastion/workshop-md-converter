import { describe, expect, it, vi } from 'vitest';
import worker from '../../src/index';
import fixture from '../fixtures/article.sample.json';

describe('render article integration', () => {
  it('renders article markdown with headers', async () => {
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
    };

    const res = await worker.fetch(req, env as never);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    expect(res.headers.get('vary')).toContain('Accept');
    expect(text).toContain('---');
    expect(text).toContain('# Hero Color Reference Table');
    expect(text).toContain('```ts');
    expect(text).not.toContain('<script');
  });

  it('returns markdown 404 for id-based article request', async () => {
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

    const req = new Request('https://worker.test/wiki/articles/8507.md', {
      headers: { accept: 'text/markdown' },
    });

    const env = {
      UPSTREAM_BASE_URL: 'https://workshop.codes',
      UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
      RENDERER_VERSION: 'v1',
      CACHE_TTL_SECONDS: '300',
    };

    const res = await worker.fetch(req, env as never);
    const text = await res.text();

    expect(res.status).toBe(404);
    expect(text).toContain('title: Article Not Found');
    expect(text).toContain('# Article Not Found');
  });

  it('renders markdown via Accept negotiation on slug path', async () => {
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

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
  });
});
