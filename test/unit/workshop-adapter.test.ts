import { describe, expect, it } from 'vitest';
import { findArticleByRef, normalizeWorkshopArticle } from '../../src/source/workshop-adapter';

const publicBaseUrl = 'https://md.example';

describe('workshop-adapter slug-first behavior', () => {
  it('builds canonical proxy and source article urls from slug', () => {
    const article = normalizeWorkshopArticle(
      {
        id: 8507,
        slug: 'hero-color-reference-table',
        title: 'Hero Color Reference Table',
        url: 'https://workshop.codes/wiki/articles/hero-color-reference-table',
      },
      publicBaseUrl,
    );

    expect(article.url).toBe('https://md.example/wiki/articles/hero-color-reference-table.md');
    expect(article.sourceUrl).toBe('https://workshop.codes/wiki/articles/hero-color-reference-table');
    expect((article as unknown as { id?: string }).id).toBeUndefined();
  });

  it('falls back to upstream base url when raw source url is missing', () => {
    const article = normalizeWorkshopArticle(
      {
        slug: 'hero-color-reference-table',
        title: 'Hero Color Reference Table',
      },
      publicBaseUrl,
      'https://workshop.codes',
    );

    expect(article.sourceUrl).toBe('https://workshop.codes/wiki/articles/hero-color-reference-table');
  });

  it('finds article by slug only', () => {
    const raw = [
      {
        id: 8507,
        slug: 'hero-color-reference-table',
        title: 'Hero Color Reference Table',
      },
    ];

    expect(findArticleByRef(raw, 'hero-color-reference-table', publicBaseUrl)?.slug).toBe('hero-color-reference-table');
    expect(findArticleByRef(raw, '8507', publicBaseUrl)).toBeUndefined();
  });
});
