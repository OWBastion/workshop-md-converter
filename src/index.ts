import { HttpError } from './core/errors';
import { logRequest } from './core/logger';
import type { Env } from './env';
import { negotiateMarkdown } from './http/negotiate';
import { buildCacheKey } from './http/cache-key';
import { isJsonBypass } from './routes/api';
import { healthRoute } from './routes/health';
import { markdownErrorResponse, markdownRoute, resolveMarkdownRoute } from './routes/markdown';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startedAt = Date.now();
    const url = new URL(request.url);

    const health = healthRoute(url.pathname);
    if (health) return health;

    if (isJsonBypass(url.pathname)) {
      return fetch(request);
    }

    const route = resolveMarkdownRoute(url.pathname);
    const wantsMarkdown = negotiateMarkdown(request, url.pathname);

    if (route.kind !== 'none' && !wantsMarkdown) {
      return markdownErrorResponse(
        406,
        'Not Acceptable',
        'This route requires a .md URL or Accept: text/markdown',
        env,
      );
    }

    if (route.kind === 'none' && !wantsMarkdown) {
      return fetch(request);
    }

    const traceId = crypto.randomUUID();
    const cacheKey = buildCacheKey(url.pathname, 'markdown', env.RENDERER_VERSION);

    try {
      const response = await markdownRoute(request, env);
      logRequest({
        traceId,
        route: url.pathname,
        upstreamUrl: response.headers.get('x-upstream-url') ?? undefined,
        articleSlug: response.headers.get('x-article-slug') ?? undefined,
        status: response.status,
        cacheStatus: 'miss',
        transformMs: Date.now() - startedAt,
        bytesIn: Number(response.headers.get('x-upstream-bytes') ?? 0),
        bytesOut: Number(response.headers.get('content-length') ?? 0),
        tokenEstimate: Number(response.headers.get('x-markdown-tokens') ?? 0),
        rendererVersion: env.RENDERER_VERSION,
      });
      response.headers.set('x-cache-key', cacheKey);
      return response;
    } catch (error) {
      if (error instanceof HttpError) {
        return markdownErrorResponse(
          error.status,
          error.status === 404 ? 'Article Not Found' : 'Upstream Error',
          error.message,
          env,
        );
      }

      return markdownErrorResponse(500, 'Internal Error', 'Failed to render markdown', env);
    }
  },
};
