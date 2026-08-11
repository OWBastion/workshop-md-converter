import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../src/index';
import { FakeCache, makeCtx, stubCaches } from '../helpers/fake-cache';

const env = {
  UPSTREAM_BASE_URL: 'https://workshop.codes',
  UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
  RENDERER_VERSION: 'v1',
  CACHE_TTL_SECONDS: '300',
  PUBLIC_BASE_URL: 'https://md.example',
};

const UPDATED_AT = '2026-03-17T19:20:21.209Z';
const LAST_MODIFIED = 'Tue, 17 Mar 2026 19:20:21 GMT';

function articleJson(content: string, updatedAt?: string): Record<string, unknown> {
  return {
    id: 4841,
    title: 'How To Use Loops',
    content,
    ...(updatedAt ? { updated_at: updatedAt } : {}),
  };
}

function stubArticleFetch(upstream: () => Record<string, unknown>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('.json')) {
        return new Response(JSON.stringify(upstream()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not found', { status: 404 });
    }),
  );
}

describe('conditional requests', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('serves a fresh article with a content-hash etag and content_hash front matter', async () => {
    stubArticleFetch(() => articleJson('# Loop Guide\n\nUse waits in loops.', UPDATED_AT));

    const res = await worker.fetch(
      new Request('https://worker.test/wiki/articles/how-to-use-loops.md', {
        headers: { accept: 'text/markdown' },
      }),
      env as never,
    );
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('x-cache-status')).toBe('MISS');
    expect(res.headers.get('etag')).toMatch(/^"[0-9a-f]{64}"$/);
    expect(res.headers.get('last-modified')).toBe(LAST_MODIFIED);
    expect(text).toMatch(/^content_hash: [0-9a-f]{64}$/m);
  });

  it('keeps the etag stable for identical content and changes it when content changes', async () => {
    let content = '# Loop Guide\n\nUse waits in loops.';
    stubArticleFetch(() => articleJson(content, UPDATED_AT));

    const first = await worker.fetch(new Request('https://worker.test/wiki/articles/how-to-use-loops.md'), env as never);
    const firstEtag = first.headers.get('etag');
    await first.text();

    const second = await worker.fetch(new Request('https://worker.test/wiki/articles/how-to-use-loops.md'), env as never);
    const secondEtag = second.headers.get('etag');
    await second.text();
    expect(secondEtag).toBe(firstEtag);

    content = '# Loop Guide v2\n\nUse more waits.';
    const changed = await worker.fetch(new Request('https://worker.test/wiki/articles/how-to-use-loops.md'), env as never);
    const changedEtag = changed.headers.get('etag');
    await changed.text();
    expect(changedEtag).not.toBe(firstEtag);
  });

  it('returns 304 with an empty body when If-None-Match matches the etag', async () => {
    stubArticleFetch(() => articleJson('# Loop Guide\n\nUse waits in loops.', UPDATED_AT));

    const first = await worker.fetch(new Request('https://worker.test/wiki/articles/how-to-use-loops.md'), env as never);
    const etag = first.headers.get('etag');
    expect(etag).not.toBeNull();
    await first.text();

    const res = await worker.fetch(
      new Request('https://worker.test/wiki/articles/how-to-use-loops.md', {
        headers: { 'if-none-match': etag ?? '' },
      }),
      env as never,
    );
    expect(res.status).toBe(304);
    expect(await res.text()).toBe('');
    expect(res.headers.get('etag')).toBe(etag);
  });

  it('returns 200 with the full markdown when If-None-Match is stale', async () => {
    stubArticleFetch(() => articleJson('# Loop Guide\n\nUse waits in loops.', UPDATED_AT));

    const res = await worker.fetch(
      new Request('https://worker.test/wiki/articles/how-to-use-loops.md', {
        headers: { 'if-none-match': '"0000000000000000000000000000000000000000000000000000000000000000"' },
      }),
      env as never,
    );
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).toContain('# Loop Guide');
    expect(text).toMatch(/^content_hash: [0-9a-f]{64}$/m);
  });

  it('returns 304 for a future If-Modified-Since and 200 for a past one', async () => {
    stubArticleFetch(() => articleJson('# Loop Guide\n\nUse waits in loops.', UPDATED_AT));

    const future = await worker.fetch(
      new Request('https://worker.test/wiki/articles/how-to-use-loops.md', {
        headers: { 'if-modified-since': 'Wed, 18 Mar 2026 00:00:00 GMT' },
      }),
      env as never,
    );
    expect(future.status).toBe(304);
    expect(await future.text()).toBe('');

    const past = await worker.fetch(
      new Request('https://worker.test/wiki/articles/how-to-use-loops.md', {
        headers: { 'if-modified-since': 'Mon, 16 Mar 2026 00:00:00 GMT' },
      }),
      env as never,
    );
    expect(past.status).toBe(200);
    expect(await past.text()).toContain('# Loop Guide');
  });

  it('serves 304 with x-cache-status HIT for a matching If-None-Match on a cached article', async () => {
    stubCaches(new FakeCache());
    const { ctx, flush } = makeCtx();
    stubArticleFetch(() => articleJson('# Loop Guide\n\nUse waits in loops.', UPDATED_AT));

    const first = await worker.fetch(
      new Request('https://worker.test/wiki/articles/how-to-use-loops.md'),
      env as never,
      ctx as never,
    );
    expect(first.status).toBe(200);
    expect(first.headers.get('x-cache-status')).toBe('MISS');
    const etag = first.headers.get('etag');
    await first.text();
    await flush();

    const second = await worker.fetch(
      new Request('https://worker.test/wiki/articles/how-to-use-loops.md'),
      env as never,
      ctx as never,
    );
    expect(second.status).toBe(200);
    expect(second.headers.get('x-cache-status')).toBe('HIT');
    expect(second.headers.get('etag')).toBe(etag);
    await second.text();

    const third = await worker.fetch(
      new Request('https://worker.test/wiki/articles/how-to-use-loops.md', {
        headers: { 'if-none-match': etag ?? '' },
      }),
      env as never,
      ctx as never,
    );
    expect(third.status).toBe(304);
    expect(third.headers.get('x-cache-status')).toBe('HIT');
    expect(await third.text()).toBe('');
  });
});
