import { describe, expect, it, vi } from 'vitest';
import worker from '../../src/index';
import fixture from '../fixtures/article.sample.json';

describe('render article integration', () => {
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
    expect(text).toContain('url: https://md.example/wiki/articles/hero-color-reference-table.md');
    expect(text).toContain('[absolute](https://md.example/wiki/articles/destroy-effect.md)');
    expect(text).toContain('https://workshop.codes/tos');
    expect(text).not.toContain('article_id:');
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
      PUBLIC_BASE_URL: 'https://md.example',
    };

    const res = await worker.fetch(req, env as never);
    const text = await res.text();

    expect(res.status).toBe(404);
    expect(text).toContain('title: Article Not Found');
    expect(text).toContain('# Article Not Found');
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
});
