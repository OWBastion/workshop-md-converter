import { describe, expect, it } from 'vitest';
import { findArticleByRef, normalizeWorkshopArticle } from '../../src/source/workshop-adapter';

const env = {
  UPSTREAM_BASE_URL: 'https://workshop.codes',
  UPSTREAM_ARTICLES_PATH: '/wiki/articles.json',
  RENDERER_VERSION: 'v1',
  CACHE_TTL_SECONDS: '300',
};

describe('workshop-adapter slug-first behavior', () => {
  it('builds canonical article url from slug even if raw url is id-based', () => {
    const article = normalizeWorkshopArticle(
      {
        id: 8507,
        slug: 'hero-color-reference-table',
        title: 'Hero Color Reference Table',
        url: 'https://workshop.codes/wiki/articles/8507',
      },
      env,
    );

    expect(article.url).toBe('https://workshop.codes/wiki/articles/hero-color-reference-table');
  });

  it('finds article by slug only', () => {
    const raw = [
      {
        id: 8507,
        slug: 'hero-color-reference-table',
        title: 'Hero Color Reference Table',
      },
    ];

    expect(findArticleByRef(raw, 'hero-color-reference-table', env)?.slug).toBe('hero-color-reference-table');
    expect(findArticleByRef(raw, '8507', env)).toBeUndefined();
  });
});
