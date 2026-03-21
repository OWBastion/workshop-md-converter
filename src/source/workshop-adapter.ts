import type { NormalizedArticle, WorkshopArticleRaw, WorkshopListRaw } from '../core/types';
import { toSlug } from '../utils/slug';

function pickString(obj: WorkshopArticleRaw, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return undefined;
}

function pickStringArray(obj: WorkshopArticleRaw, keys: string[]): string[] {
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    }
  }
  return [];
}

function normalizeSlug(slug: string): string {
  return slug.replace(/\.md$/i, '').trim();
}

function toArticleUrl(base: string, slug: string): string {
  return new URL(`/wiki/articles/${normalizeSlug(slug)}.md`, base).toString();
}

function toSourceArticleUrl(base: string, slug: string): string {
  return new URL(`/wiki/articles/${normalizeSlug(slug)}`, base).toString();
}

export function extractArticles(raw: WorkshopListRaw): WorkshopArticleRaw[] {
  const candidates = [raw.data, raw.items, raw.articles, raw];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as WorkshopArticleRaw[];
  }
  if (raw && typeof raw === 'object') {
    const maybeArray = Object.values(raw).find((x) => Array.isArray(x));
    if (Array.isArray(maybeArray)) return maybeArray as WorkshopArticleRaw[];
  }
  return [];
}

export function normalizeWorkshopArticle(
  raw: WorkshopArticleRaw,
  publicBaseUrl: string,
  upstreamBaseUrl = 'https://workshop.codes',
): NormalizedArticle {
  const titleFallback = pickString(raw, ['title', 'name']) ?? 'Untitled Article';
  const slugCandidate = pickString(raw, ['slug']) ?? (toSlug(titleFallback) || 'untitled-article');
  const slug = normalizeSlug(slugCandidate);
  const title = pickString(raw, ['title', 'name']) ?? slug;
  const description = pickString(raw, ['description', 'summary', 'excerpt']);
  const category = pickString(raw, ['category']);
  const contentRaw = pickString(raw, ['content', 'body', 'markdown', 'text']) ?? '';
  const createdAt = pickString(raw, ['created_at', 'createdAt']);
  const updatedAt = pickString(raw, ['updated_at', 'updatedAt']);
  const tags = pickStringArray(raw, ['tags', 'labels']);
  const url = toArticleUrl(publicBaseUrl, slug);
  const sourceUrl = toSourceArticleUrl(upstreamBaseUrl, slug);

  const known = new Set([
    'title',
    'name',
    'slug',
    'description',
    'summary',
    'excerpt',
    'category',
    'content',
    'body',
    'markdown',
    'text',
    'created_at',
    'createdAt',
    'updated_at',
    'updatedAt',
    'tags',
    'labels',
    'url',
  ]);

  const extra = Object.fromEntries(Object.entries(raw).filter(([key]) => !known.has(key)));

  return {
    slug,
    title,
    description,
    url,
    sourceUrl,
    source: 'workshop',
    category,
    tags,
    createdAt,
    updatedAt,
    contentRaw,
    contentMarkdown: contentRaw,
    extra,
  };
}

export function findArticleByRef(
  articles: WorkshopArticleRaw[],
  ref: string,
  publicBaseUrl: string,
  upstreamBaseUrl = 'https://workshop.codes',
): NormalizedArticle | undefined {
  for (const article of articles) {
    const normalized = normalizeWorkshopArticle(article, publicBaseUrl, upstreamBaseUrl);
    if (normalized.slug === normalizeSlug(ref)) {
      return normalized;
    }
  }
  return undefined;
}
