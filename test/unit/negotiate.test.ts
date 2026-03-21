import { describe, expect, it } from 'vitest';
import { negotiateMarkdown } from '../../src/http/negotiate';

describe('negotiateMarkdown', () => {
  it('accepts .md routes', () => {
    const req = new Request('https://x.test/wiki/articles/1', { headers: { accept: 'text/html' } });
    expect(negotiateMarkdown(req, '/wiki/articles/1.md')).toBe(true);
  });

  it('accepts markdown in accept header', () => {
    const req = new Request('https://x.test/wiki/articles/1', { headers: { accept: 'text/markdown, text/html' } });
    expect(negotiateMarkdown(req, '/wiki/articles/1')).toBe(true);
  });

  it('rejects non markdown requests', () => {
    const req = new Request('https://x.test/wiki/articles/1', { headers: { accept: 'text/html' } });
    expect(negotiateMarkdown(req, '/wiki/articles/1')).toBe(false);
  });
});
