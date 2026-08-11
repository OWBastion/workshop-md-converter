import { describe, expect, it } from 'vitest';
import { buildFrontMatter, renderArticleMarkdown } from '../../src/transform/markdown-template';
import type { NormalizedArticle } from '../../src/core/types';

const article: NormalizedArticle = {
  slug: 'hero-color-reference-table',
  title: 'Hero Color Reference Table',
  description: 'Workshop.code wiki article',
  url: 'https://md.example/wiki/articles/hero-color-reference-table.md',
  sourceUrl: 'https://workshop.codes/wiki/articles/hero-color-reference-table',
  source: 'workshop',
  category: 'References',
  tags: ['Color'],
  createdAt: '2026-03-17T19:20:21.209Z',
  updatedAt: '2026-03-17T19:20:21.209Z',
  contentRaw: 'x',
  contentMarkdown: 'x',
};

describe('markdown-template', () => {
  it('builds front matter with the canonical schema', () => {
    const fm = buildFrontMatter(article);
    expect(fm).toContain('title: Hero Color Reference Table');
    expect(fm).toContain('content_type: wiki-article');
  });

  it('renders article markdown', async () => {
    const rendered = await renderArticleMarkdown(article);
    expect(rendered.markdown).toContain('# Hero Color Reference Table');
    expect(rendered.markdown).toContain('## Content');
    expect(rendered.markdown).toContain('> Source: https://workshop.codes/wiki/articles/hero-color-reference-table');
    expect(rendered.markdown).not.toContain('> Notice:');
    expect(rendered.tokens).toBeGreaterThan(0);
    expect(rendered.lastModified).toBeDefined();
  });

  it('includes a 64-hex content_hash line in the article front matter', async () => {
    const rendered = await renderArticleMarkdown(article);
    expect(rendered.markdown).toMatch(/^content_hash: [0-9a-f]{64}$/m);
    expect(rendered.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rendered.markdown).toContain(`content_hash: ${rendered.contentHash}`);
  });

  it('is deterministic: the same article always renders the same content hash', async () => {
    const first = await renderArticleMarkdown(article);
    const second = await renderArticleMarkdown(article);
    expect(second.contentHash).toBe(first.contentHash);
    expect(second.markdown).toBe(first.markdown);
  });

  it('yields a different content hash when the article body changes', async () => {
    const base = await renderArticleMarkdown(article);
    const changed = await renderArticleMarkdown({ ...article, contentMarkdown: 'y' });
    expect(changed.contentHash).not.toBe(base.contentHash);
    expect(changed.markdown).not.toBe(base.markdown);
  });
});
