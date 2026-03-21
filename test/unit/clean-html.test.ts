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

  it('maps safe tags and normalizes links', () => {
    const input = '<strong>bold</strong> <a href="/a">go</a>';
    const out = cleanContent(input, 'https://workshop.codes/wiki/articles/1');
    expect(out).toContain('**bold**');
    expect(out).toContain('[go](https://workshop.codes/a)');
  });
});
