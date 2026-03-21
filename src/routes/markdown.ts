import { HttpError } from '../core/errors';
import { fetchJson } from '../source/fetch-json';
import { extractArticles, findArticleByRef, normalizeArticleRef, normalizeWorkshopSingleArticle } from '../source/workshop-adapter';
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

function resolvePublicBaseUrl(request: Request, env: Env): string {
  if (env.PUBLIC_BASE_URL && env.PUBLIC_BASE_URL.trim()) {
    return env.PUBLIC_BASE_URL;
  }
  return new URL(request.url).origin;
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

  const publicBaseUrl = resolvePublicBaseUrl(request, env);
  const upstream = await fetchJson<Record<string, unknown>>(env, env.UPSTREAM_ARTICLES_PATH);
  const raw = upstream.data;

  if (route.kind === 'index') {
    const list = normalizeWorkshopList(raw, publicBaseUrl, env.UPSTREAM_BASE_URL);
    const rendered = renderIndexMarkdown(list);
    const etag = computeEtag([pathname, env.RENDERER_VERSION, String(list.length)]);
    const response = markdownResponse({
      markdown: rendered.markdown,
      tokens: rendered.tokens,
      etag,
      env,
    });
    response.headers.set('x-upstream-url', upstream.upstreamUrl);
    response.headers.set('x-upstream-bytes', String(upstream.bytesIn));
    return response;
  }

  const articles = extractArticles(raw);
  const refSlug = normalizeArticleRef(route.ref);
  let article = findArticleByRef(articles, refSlug, publicBaseUrl, env.UPSTREAM_BASE_URL);
  let articleSource = upstream;
  if (!article) {
    try {
      const single = await fetchJson<Record<string, unknown>>(env, `/wiki/articles/${refSlug}.json`);
      article = normalizeWorkshopSingleArticle(single.data, publicBaseUrl, env.UPSTREAM_BASE_URL);
      articleSource = single;
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 404) {
        throw error;
      }
    }
  }
  if (!article) {
    throw new HttpError(404, 'Article Not Found');
  }

  const cleaned = cleanContent(article.contentRaw, publicBaseUrl);
  const rendered = renderArticleMarkdown({ ...article, contentMarkdown: cleaned });
  const etag = computeEtag([article.slug, article.updatedAt ?? 'na', env.RENDERER_VERSION]);

  const response = markdownResponse({
    markdown: rendered.markdown,
    tokens: rendered.tokens,
    etag,
    lastModified: rendered.lastModified,
    env,
  });
  response.headers.set('x-upstream-url', articleSource.upstreamUrl);
  response.headers.set('x-upstream-bytes', String(articleSource.bytesIn));
  response.headers.set('x-article-slug', article.slug);
  return response;
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
