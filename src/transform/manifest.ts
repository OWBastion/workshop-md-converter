import type { NormalizedArticle } from '../core/types';

/**
 * Manifest generation operates strictly on list metadata.
 *
 * Per the #41 generation-cost boundary, building a manifest must never render
 * or hash article bodies: exact per-document content hashes come from the
 * article route itself (#39). Only fields already present on the normalized
 * list are projected here, so no article body/content can leak into the
 * manifest payload.
 */
export const MANIFEST_SCHEMA_VERSION = 1;

export interface ManifestDocument {
  title: string;
  slug: string;
  category?: string;
  markdownUrl: string;
  sourceUrl: string;
  updatedAt?: string;
  aliases: string[];
}

export interface Manifest {
  schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  documents: ManifestDocument[];
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      unique.push(value);
    }
  }
  return unique;
}

export function buildManifest(articles: NormalizedArticle[]): Manifest {
  const documents = articles
    .map((article) => {
      const document: ManifestDocument = {
        title: article.title,
        slug: article.slug,
        markdownUrl: article.url,
        sourceUrl: article.sourceUrl,
        aliases: dedupe([article.title, article.slug]),
      };
      if (article.category !== undefined) {
        document.category = article.category;
      }
      if (article.updatedAt !== undefined) {
        document.updatedAt = article.updatedAt;
      }
      return document;
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

  return { schemaVersion: MANIFEST_SCHEMA_VERSION, documents };
}
