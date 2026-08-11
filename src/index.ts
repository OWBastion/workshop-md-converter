import { HttpError } from './core/errors';
import { logRequest } from './core/logger';
import { NOT_FOUND_CACHE_TTL_SECONDS, getCacheTtlSeconds } from './core/config';
import type { Env } from './env';
import { negotiateMarkdown } from './http/negotiate';
import { buildCacheKey } from './http/cache-key';
import { cacheLookup, cacheStore, generatedCacheUrl } from './cache/cache-api';
import { isJsonBypass } from './routes/api';
import { healthRoute } from './routes/health';
import { homeRoute } from './routes/home';
import { markdownErrorResponse, markdownRoute, resolveMarkdownRoute } from './routes/markdown';

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const startedAt = Date.now();
    const url = new URL(request.url);

    const health = healthRoute(url.pathname);
    if (health) return health;

    const home = homeRoute(url.pathname, env);
    if (home) return home;

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
    const cacheUrl = generatedCacheUrl(cacheKey);

    const cached = await cacheLookup(cacheUrl);
    if (cached) {
      cached.headers.set('vary', 'Accept');
      cached.headers.set('x-cache-key', cacheKey);
      cached.headers.set('x-cache-status', 'HIT');
      logRequest({
        traceId,
        route: url.pathname,
        status: cached.status,
        cacheStatus: 'hit',
        rendererVersion: env.RENDERER_VERSION,
      });
      return cached;
    }

    try {
      const response = await markdownRoute(request, env, ctx);
      logRequest({
        traceId,
        route: url.pathname,
        upstreamUrl: response.headers.get('x-upstream-url') ?? undefined,
        articleSlug: response.headers.get('x-article-slug') ?? undefined,
        status: response.status,
        cacheStatus: 'miss',
        upstreamCache: response.headers.get('x-upstream-cache') ?? undefined,
        transformMs: Date.now() - startedAt,
        bytesIn: Number(response.headers.get('x-upstream-bytes') ?? 0),
        bytesOut: Number(response.headers.get('content-length') ?? 0),
        tokenEstimate: Number(response.headers.get('x-markdown-tokens') ?? 0),
        rendererVersion: env.RENDERER_VERSION,
      });
      if (ctx) ctx.waitUntil(cacheStore(cacheUrl, response.clone(), getCacheTtlSeconds(env)));
      response.headers.set('x-cache-key', cacheKey);
      response.headers.set('x-cache-status', 'MISS');
      return response;
    } catch (error) {
      if (error instanceof HttpError) {
        const response = markdownErrorResponse(
          error.status,
          error.status === 404 ? 'Article Not Found' : 'Upstream Error',
          error.message,
          env,
        );
        logRequest({
          traceId,
          route: url.pathname,
          status: response.status,
          cacheStatus: 'miss',
          transformMs: Date.now() - startedAt,
          rendererVersion: env.RENDERER_VERSION,
        });
        if (ctx && error.status === 404) {
          ctx.waitUntil(cacheStore(cacheUrl, response.clone(), NOT_FOUND_CACHE_TTL_SECONDS));
        }
        response.headers.set('x-cache-key', cacheKey);
        response.headers.set('x-cache-status', 'MISS');
        return response;
      }

      const response = markdownErrorResponse(500, 'Internal Error', 'Failed to render markdown', env);
      logRequest({
        traceId,
        route: url.pathname,
        status: response.status,
        cacheStatus: 'miss',
        transformMs: Date.now() - startedAt,
        rendererVersion: env.RENDERER_VERSION,
      });
      response.headers.set('x-cache-key', cacheKey);
      response.headers.set('x-cache-status', 'MISS');
      return response;
    }
  },
};
