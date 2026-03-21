import { describe, expect, it } from 'vitest';
import {
  findArticleByRef,
  normalizeArticleRef,
  normalizeWorkshopArticle,
  normalizeWorkshopSingleArticle,
} from '../../src/source/workshop-adapter';

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

  it('normalizes article refs and supports single article payloads', () => {
    expect(normalizeArticleRef('how-to-use-loops.md')).toBe('how-to-use-loops');
    expect(normalizeArticleRef(' how-to-use-loops ')).toBe('how-to-use-loops');

    const article = normalizeWorkshopSingleArticle(
      {
        title: 'How To Use Loops',
        content: '# Loop Guide',
        id: 4841,
      },
      publicBaseUrl,
    );

    expect(article.slug).toBe('how-to-use-loops');
    expect(article.extra).toEqual({ id: 4841 });
  });
});
