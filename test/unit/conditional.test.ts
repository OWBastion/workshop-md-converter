import { describe, expect, it } from 'vitest';
import { maybeNotModified } from '../../src/http/conditional';

function okResponse(): Response {
  return new Response('body', {
    status: 200,
    headers: {
      etag: '"abc"',
      'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
      'cache-control': 'public, max-age=300, s-maxage=300',
      vary: 'Accept',
      'x-cache-key': 'k',
      'x-cache-status': 'MISS',
    },
  });
}

describe('maybeNotModified', () => {
  it('returns 304 when If-None-Match matches, preserving cache headers', () => {
    const req = new Request('https://x.test/a', { headers: { 'if-none-match': '"abc"' } });
    const res = maybeNotModified(req, okResponse());
    expect(res?.status).toBe(304);
    expect(res?.headers.get('etag')).toBe('"abc"');
    expect(res?.headers.get('cache-control')).toContain('max-age=300');
    expect(res?.headers.get('vary')).toBe('Accept');
    expect(res?.headers.get('x-cache-status')).toBe('MISS');
    expect(res?.body).toBeNull();
  });

  it('matches weak ETags and ETag lists', () => {
    const req = new Request('https://x.test/a', { headers: { 'if-none-match': 'W/"abc", "zzz"' } });
    expect(maybeNotModified(req, okResponse())?.status).toBe(304);
    expect(maybeNotModified(new Request('https://x.test/a', { headers: { 'if-none-match': '*' } }), okResponse())?.status).toBe(304);
  });

  it('serves the full response when If-None-Match does not match', () => {
    const req = new Request('https://x.test/a', { headers: { 'if-none-match': '"zzz"' } });
    expect(maybeNotModified(req, okResponse())).toBeUndefined();
  });

  it('returns 304 when If-Modified-Since is not older than Last-Modified', () => {
    const req = new Request('https://x.test/a', { headers: { 'if-modified-since': 'Thu, 22 Oct 2015 07:28:00 GMT' } });
    expect(maybeNotModified(req, okResponse())?.status).toBe(304);
  });

  it('serves the full response when If-Modified-Since is older than Last-Modified', () => {
    const req = new Request('https://x.test/a', { headers: { 'if-modified-since': 'Tue, 20 Oct 2015 07:28:00 GMT' } });
    expect(maybeNotModified(req, okResponse())).toBeUndefined();
  });

  it('ignores conditional headers on non-200 responses', () => {
    const res = new Response('nf', { status: 404, headers: { etag: '"abc"' } });
    expect(maybeNotModified(new Request('https://x.test/a', { headers: { 'if-none-match': '"abc"' } }), res)).toBeUndefined();
  });
});
