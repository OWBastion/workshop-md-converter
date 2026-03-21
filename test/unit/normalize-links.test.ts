import { describe, expect, it } from 'vitest';
import { normalizeLinks } from '../../src/transform/normalize-links';

describe('normalizeLinks', () => {
  it('rewrites relative and workshop absolute article links to proxy md links', () => {
    const md = [
      '[r](/wiki/articles/destroy-effect)',
      '[a](https://workshop.codes/wiki/articles/abc?x=1#h)',
      '[keep](https://example.com/wiki/articles/abc)',
    ].join('\n');

    const out = normalizeLinks(md, 'https://md.example');

    expect(out).toContain('[r](https://md.example/wiki/articles/destroy-effect.md)');
    expect(out).toContain('[a](https://md.example/wiki/articles/abc.md?x=1#h)');
    expect(out).toContain('[keep](https://example.com/wiki/articles/abc)');
  });
});
