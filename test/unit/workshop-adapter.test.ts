import { describe, expect, it } from 'vitest';
import { findArticleByRef, normalizeWorkshopArticle } from '../../src/source/workshop-adapter';

const publicBaseUrl = 'https://md.example';

describe('workshop-adapter slug-first behavior', () => {
  it('builds canonical proxy and source article urls from slug', () => {
    const article = normalizeWorkshopArticle(
      {
        slug: 'hero-color-reference-table',
        title: 'Hero Color Reference Table',
        url: 'https://workshop.codes/wiki/articles/hero-color-reference-table',
      },
      publicBaseUrl,
    );

    expect(article.url).toBe('https://md.example/wiki/articles/hero-color-reference-table.md');
    expect(article.sourceUrl).toBe('https://workshop.codes/wiki/articles/hero-color-reference-table');
  });

  it('keeps source url canonical when raw url is slug-based', () => {
    const article = normalizeWorkshopArticle(
      {
        slug: 'hero-color-reference-table',
        title: 'Hero Color Reference Table',
        url: 'https://workshop.codes/wiki/articles/hero-color-reference-table',
      },
      publicBaseUrl,
    );

    expect(article.sourceUrl).toBe('https://workshop.codes/wiki/articles/hero-color-reference-table');
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
        slug: 'hero-color-reference-table',
        title: 'Hero Color Reference Table',
      },
    ];

    expect(findArticleByRef(raw, 'hero-color-reference-table', publicBaseUrl)?.slug).toBe('hero-color-reference-table');
    expect(findArticleByRef(raw, 'unknown-article', publicBaseUrl)).toBeUndefined();
  });
});
