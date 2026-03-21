import { HttpError } from '../core/errors';
import { fetchJson } from '../source/fetch-json';
import { extractArticles, findArticleByRef } from '../source/workshop-adapter';
import { normalizeWorkshopList } from '../source/normalize';
import { cleanContent } from '../transform/clean-html';
import { renderArticleMarkdown, renderIndexMarkdown } from '../transform/markdown-template';
import { markdownResponse } from '../http/response';
import type { Env } from '../env';

type RouteKind =
  | { kind: 'index' }
  | { kind: 'article'; ref: string }
  | { kind: 'none' };

export function resolveMarkdownRoute(pathname: string): RouteKind {
  if (pathname === '/wiki/articles.md' || pathname === '/wiki/articles') {
    return { kind: 'index' };
  }

  const match = pathname.match(/^\/wiki\/articles\/([^/]+?)(?:\.md)?$/);
  if (match) {
    return { kind: 'article', ref: match[1] };
  }

  return { kind: 'none' };
}

function computeEtag(parts: string[]): string {
  const input = parts.join('::');
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `"${(hash >>> 0).toString(16)}"`;
}

export async function markdownRoute(request: Request, env: Env): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  const route = resolveMarkdownRoute(pathname);
  if (route.kind === 'none') {
    throw new HttpError(404, 'Markdown route not found');
  }

  const raw = await fetchJson<Record<string, unknown>>(env, env.UPSTREAM_ARTICLES_PATH);

  if (route.kind === 'index') {
    const list = normalizeWorkshopList(raw, env);
    const rendered = renderIndexMarkdown(list);
    const etag = computeEtag([pathname, env.RENDERER_VERSION, String(list.length)]);
    return markdownResponse({
      markdown: rendered.markdown,
      tokens: rendered.tokens,
      etag,
      env,
    });
  }

  const articles = extractArticles(raw);
  const article = findArticleByRef(articles, route.ref, env);
  if (!article) {
    throw new HttpError(404, 'Article Not Found');
  }

  const cleaned = cleanContent(article.contentRaw, article.url);
  const rendered = renderArticleMarkdown({ ...article, contentMarkdown: cleaned });
  const etag = computeEtag([article.id, article.updatedAt ?? 'na', env.RENDERER_VERSION]);

  return markdownResponse({
    markdown: rendered.markdown,
    tokens: rendered.tokens,
    etag,
    lastModified: rendered.lastModified,
    env,
  });
}

export function markdownErrorResponse(status: number, title: string, message: string, env: Env): Response {
  const markdown = `---\ntitle: ${title}\ntype: error\nstatus: ${status}\n---\n\n# ${title}\n\n${message}\n`;
  const etag = computeEtag([String(status), title, env.RENDERER_VERSION]);
  return markdownResponse({
    markdown,
    tokens: Math.ceil(markdown.length / 4),
    etag,
    env,
    status,
  });
}
