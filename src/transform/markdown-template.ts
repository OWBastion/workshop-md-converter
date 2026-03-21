import type { NormalizedArticle } from '../core/types';
import { toFrontMatter } from '../utils/yaml';
import { toHttpDate } from '../utils/time';
import { estimateTokens } from './tokens';

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
    updated_at: article.updatedAt,
    content_type: 'wiki-article',
  });
}

export function renderArticleMarkdown(article: NormalizedArticle): { markdown: string; tokens: number; lastModified?: string } {
  const frontMatter = buildFrontMatter(article);
  const meta = [
    `> Source: ${article.sourceUrl}`,
    article.category ? `> Category: ${article.category}` : undefined,
    article.updatedAt ? `> Updated: ${article.updatedAt}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  const markdown = [
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

  return {
    markdown,
    tokens: estimateTokens(markdown),
    lastModified: toHttpDate(article.updatedAt),
  };
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
