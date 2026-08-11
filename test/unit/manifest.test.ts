import { describe, expect, it } from 'vitest';
import type { NormalizedArticle } from '../../src/core/types';
import { resolveManifestRoute } from '../../src/routes/manifest';
import { MANIFEST_SCHEMA_VERSION, buildManifest } from '../../src/transform/manifest';

function makeArticle(overrides: Partial<NormalizedArticle> = {}): NormalizedArticle {
  return {
    slug: 'slug',
    title: 'Title',
    url: 'https://md.example/wiki/articles/slug.md',
    sourceUrl: 'https://workshop.codes/wiki/articles/slug',
    source: 'workshop',
    tags: [],
    contentRaw: '',
    contentMarkdown: '',
    ...overrides,
  };
}

describe('buildManifest', () => {
  it('emits the explicit schema version and a documents array', () => {
    expect(MANIFEST_SCHEMA_VERSION).toBe(1);
    const manifest = buildManifest([]);
    expect(manifest.schemaVersion).toBe(1);
    expect(Array.isArray(manifest.documents)).toBe(true);
    expect(manifest.documents).toHaveLength(0);
  });

  it('sorts documents by slug ascending regardless of input order', () => {
    const manifest = buildManifest([
      makeArticle({ slug: 'zebra', title: 'Zebra' }),
      makeArticle({ slug: 'alpha', title: 'Alpha' }),
      makeArticle({ slug: 'mike', title: 'Mike' }),
    ]);
    expect(manifest.documents.map((doc) => doc.slug)).toEqual(['alpha', 'mike', 'zebra']);
  });

  it('produces byte-identical output for the same input', () => {
    const articles = [
      makeArticle({ slug: 'b', title: 'B', category: 'Refs', updatedAt: '2026-01-01T00:00:00.000Z' }),
      makeArticle({ slug: 'a', title: 'A' }),
    ];
    const forward = JSON.stringify(buildManifest(articles));
    const reversed = JSON.stringify(buildManifest([...articles].reverse()));
    expect(forward).toBe(reversed);
  });

  it('builds aliases from title and slug, deduplicated in order', () => {
    const distinct = buildManifest([makeArticle({ title: 'Zebra', slug: 'zebra' })]);
    expect(distinct.documents[0]?.aliases).toEqual(['Zebra', 'zebra']);

    const duplicate = buildManifest([makeArticle({ title: 'exact', slug: 'exact' })]);
    expect(duplicate.documents[0]?.aliases).toEqual(['exact']);
  });

  it('projects absolute markdown and source URLs from the normalized article', () => {
    const manifest = buildManifest([
      makeArticle({
        slug: 'loops',
        url: 'https://md.example/wiki/articles/loops.md',
        sourceUrl: 'https://workshop.codes/wiki/articles/loops',
      }),
    ]);
    const doc = manifest.documents[0];
    expect(doc?.markdownUrl).toBe('https://md.example/wiki/articles/loops.md');
    expect(doc?.sourceUrl).toBe('https://workshop.codes/wiki/articles/loops');
  });

  it('omits category and updatedAt keys when absent', () => {
    const manifest = buildManifest([makeArticle()]);
    const doc = manifest.documents[0];
    expect(doc).toBeDefined();
    expect(doc).not.toHaveProperty('category');
    expect(doc).not.toHaveProperty('updatedAt');
    expect(JSON.stringify(manifest)).not.toContain('category');
    expect(JSON.stringify(manifest)).not.toContain('updatedAt');
  });

  it('includes category and updatedAt when present', () => {
    const manifest = buildManifest([
      makeArticle({ category: 'References', updatedAt: '2026-03-17T19:20:21.209Z' }),
    ]);
    const doc = manifest.documents[0];
    expect(doc).toHaveProperty('category', 'References');
    expect(doc).toHaveProperty('updatedAt', '2026-03-17T19:20:21.209Z');
  });

  it('never leaks article body content into the manifest', () => {
    const marker = 'BODY-MARKER-NEVER-LEAK';
    const manifest = buildManifest([
      makeArticle({ contentRaw: `<p>${marker}</p>`, contentMarkdown: `${marker} **bold**` }),
    ]);
    expect(JSON.stringify(manifest)).not.toContain(marker);
  });
});

describe('resolveManifestRoute', () => {
  it('resolves /manifest.json to the manifest route', () => {
    expect(resolveManifestRoute('/manifest.json')).toEqual({ kind: 'manifest' });
  });

  it('resolves other paths to none', () => {
    expect(resolveManifestRoute('/')).toEqual({ kind: 'none' });
    expect(resolveManifestRoute('/wiki/articles.md')).toEqual({ kind: 'none' });
    expect(resolveManifestRoute('/manifest.json/')).toEqual({ kind: 'none' });
  });
});
