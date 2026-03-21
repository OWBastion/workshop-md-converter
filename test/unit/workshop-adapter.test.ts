import { describe, expect, it } from 'vitest';
import { findArticleByRef, normalizeWorkshopArticle } from '../../src/source/workshop-adapter';

const publicBaseUrl = 'https://md.example';

describe('workshop-adapter slug-first behavior', () => {
  it('builds canonical md article url from slug', () => {
    const article = normalizeWorkshopArticle(
      {
        id: 8507,
        slug: 'hero-color-reference-table',
        title: 'Hero Color Reference Table',
      },
      publicBaseUrl,
    );

    expect(article.url).toBe('https://md.example/wiki/articles/hero-color-reference-table.md');
    expect((article as unknown as { id?: string }).id).toBeUndefined();
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
