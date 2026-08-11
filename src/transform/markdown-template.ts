import type { NormalizedArticle } from '../core/types';
import { toFrontMatter } from '../utils/yaml';
import { toHttpDate } from '../utils/time';
import { estimateTokens } from './tokens';
import { sha256Hex } from '../utils/hash';

export function buildFrontMatter(article: NormalizedArticle): string {
  return toFrontMatter({
    title: article.title,
    description: article.description ?? 'Workshop.code wiki article',
    url: article.url,
    source: article.source,
    slug: article.slug,
    category: article.category,
    tags: article.tags,
    created_at: article.createdAt,
    // `updated_at` already carries the upstream source update time; there is
    // intentionally no separate `source_updated_at` field.
    updated_at: article.updatedAt,
    content_type: 'wiki-article',
  });
}

export async function renderArticleMarkdown(
  article: NormalizedArticle,
): Promise<{ markdown: string; tokens: number; lastModified?: string; contentHash: string }> {
  const frontMatter = buildFrontMatter(article);
  const meta = [
    `> Source: ${article.sourceUrl}`,
    article.category ? `> Category: ${article.category}` : undefined,
    article.updatedAt ? `> Updated: ${article.updatedAt}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  // Hash source of truth: content_hash is sha256Hex over the full rendered
  // Markdown document EXCLUDING the content_hash line itself, which avoids a
  // self-referential (circular) hash. The document is rendered once without the
  // hash line, that exact string is hashed, then the final document is emitted
  // with the hash line inserted. The hash is deterministic: identical inputs
  // always yield an identical hash, and any change to title/description/tags/
  // updated_at/body yields a different hash.
  const documentWithoutHash = [
    frontMatter,
    '',
    `# ${article.title}`,
    '',
    meta,
    '',
    '## Content',
    '',
    article.contentMarkdown,
    '',
  ].join('\n');

  const contentHash = await sha256Hex(documentWithoutHash);

  const markdown = [
    withContentHash(frontMatter, contentHash),
    '',
    `# ${article.title}`,
    '',
    meta,
    '',
    '## Content',
    '',
    article.contentMarkdown,
    '',
  ].join('\n');

  return {
    markdown,
    tokens: estimateTokens(markdown),
    lastModified: toHttpDate(article.updatedAt),
    contentHash,
  };
}

function withContentHash(frontMatter: string, contentHash: string): string {
  return `${frontMatter.slice(0, -3)}content_hash: ${contentHash}\n---`;
}

export function renderIndexMarkdown(articles: NormalizedArticle[]): { markdown: string; tokens: number } {
  const frontMatter = toFrontMatter({
    title: 'Workshop.code wiki articles index',
    source: 'workshop',
    content_type: 'wiki-article-index',
    count: articles.length,
    generated_at: new Date().toISOString(),
  });

  const lines: string[] = [frontMatter, '', '# Workshop.code Wiki Articles', '', '## Articles', ''];
  for (const article of articles) {
    lines.push(`- [${article.title}](${article.url})`);
    if (article.category) lines.push(`  - category: ${article.category}`);
    if (article.updatedAt) lines.push(`  - updated_at: ${article.updatedAt}`);
  }

  const markdown = `${lines.join('\n')}\n`;
  return {
    markdown,
    tokens: estimateTokens(markdown),
  };
}
