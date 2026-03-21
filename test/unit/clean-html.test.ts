import { describe, expect, it } from 'vitest';
import { cleanContent, decodeEntities, stripStyleTags } from '../../src/transform/clean-html';

describe('clean-html', () => {
  it('decodes entities', () => {
    expect(decodeEntities('&amp; &lt;')).toBe('& <');
  });

  it('strips style and script tags', () => {
    const input = '<style>.a{}</style><script>alert(1)</script><span style="color:red">x</span>';
    const out = stripStyleTags(input);
    expect(out).not.toContain('<style');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('style=');
  });

  it('maps safe tags and rewrites workshop article links to proxy md links', () => {
    const input = '<strong>bold</strong> <a href="/wiki/articles/destroy-effect">relative</a> <a href="https://workshop.codes/wiki/articles/abc?x=1#h">absolute</a>';
    const out = cleanContent(input, 'https://md.example');
    expect(out).toContain('**bold**');
    expect(out).toContain('[relative](https://md.example/wiki/articles/destroy-effect.md)');
    expect(out).toContain('[absolute](https://md.example/wiki/articles/abc.md?x=1#h)');
  });
});
