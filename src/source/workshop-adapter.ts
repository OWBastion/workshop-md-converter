import type { NormalizedArticle, WorkshopArticleRaw, WorkshopListRaw } from '../core/types';
import type { Env } from '../env';
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

function toArticleUrl(base: string, slug: string): string {
  return new URL(`/wiki/articles/${slug}`, base).toString();
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

export function normalizeWorkshopArticle(raw: WorkshopArticleRaw, env: Env): NormalizedArticle {
  const id = pickString(raw, ['id', 'article_id', 'articleId']) ?? 'unknown';
  const title = pickString(raw, ['title', 'name']) ?? `Article ${id}`;
  const slug = pickString(raw, ['slug']) ?? (toSlug(title) || id);
  const description = pickString(raw, ['description', 'summary', 'excerpt']);
  const category = pickString(raw, ['category']);
  const contentRaw = pickString(raw, ['content', 'body', 'markdown', 'text']) ?? '';
  const createdAt = pickString(raw, ['created_at', 'createdAt']);
  const updatedAt = pickString(raw, ['updated_at', 'updatedAt']);
  const tags = pickStringArray(raw, ['tags', 'labels']);
  // Canonical article URL is slug-based by contract.
  const url = toArticleUrl(env.UPSTREAM_BASE_URL, slug);

  const known = new Set([
    'id',
    'article_id',
    'articleId',
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
    id,
    slug,
    title,
    description,
    url,
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

export function findArticleByRef(articles: WorkshopArticleRaw[], ref: string, env: Env): NormalizedArticle | undefined {
  for (const article of articles) {
    const normalized = normalizeWorkshopArticle(article, env);
    if (normalized.slug === ref) {
      return normalized;
    }
  }
  return undefined;
}
