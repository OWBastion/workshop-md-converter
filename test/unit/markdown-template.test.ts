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
  it('builds front matter without legacy id fields', () => {
    const fm = buildFrontMatter(article);
    expect(fm).toContain('title: Hero Color Reference Table');
    expect(fm).toContain('content_type: wiki-article');
    expect(fm).not.toContain('article_id');
  });

  it('renders article markdown', () => {
    const rendered = renderArticleMarkdown(article);
    expect(rendered.markdown).toContain('# Hero Color Reference Table');
    expect(rendered.markdown).toContain('## Content');
    expect(rendered.markdown).toContain('> Source: https://workshop.codes/wiki/articles/hero-color-reference-table');
    expect(rendered.markdown).not.toContain('> Notice:');
    expect(rendered.tokens).toBeGreaterThan(0);
    expect(rendered.lastModified).toBeDefined();
  });
});
