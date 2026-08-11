import {
  DEFAULT_TIMEOUT_MS,
  MAX_UPSTREAM_BYTES,
  NOT_FOUND_CACHE_TTL_SECONDS,
  getUpstreamCacheTtlSeconds,
  normalizeUpstreamUrl,
} from '../core/config';
import { HttpError } from '../core/errors';
import type { Env } from '../env';
import { cacheLookup, cacheStore, upstreamCacheUrl } from '../cache/cache-api';

export interface FetchJsonResult<T> {
  data: T;
  bytesIn: number;
  upstreamUrl: string;
  fromCache: boolean;
}

export async function fetchJson<T>(env: Env, path: string, ctx?: ExecutionContext): Promise<FetchJsonResult<T>> {
  const base = normalizeUpstreamUrl(env);
  const url = new URL(path, base);
  const upstreamUrl = url.toString();
  const cacheUrl = upstreamCacheUrl(upstreamUrl);

  const cached = await cacheLookup(cacheUrl);
  if (cached) {
    try {
      const text = await cached.text();
      if (text.length > MAX_UPSTREAM_BYTES) {
        throw new HttpError(502, 'Upstream payload too large');
      }
      if (!cached.ok) {
        throw new HttpError(cached.status, `Upstream request failed: ${cached.status}`);
      }
      return {
        data: JSON.parse(text) as T,
        bytesIn: text.length,
        upstreamUrl,
        fromCache: true,
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, 'Failed to fetch upstream JSON');
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    });

    const contentLength = Number(res.headers.get('content-length') ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_UPSTREAM_BYTES) {
      throw new HttpError(502, 'Upstream payload too large');
    }

    if (!res.ok) {
      if (res.status === 404) {
        const notFound = new Response('', { status: 404 });
        if (ctx) ctx.waitUntil(cacheStore(cacheUrl, notFound, NOT_FOUND_CACHE_TTL_SECONDS));
      }
      throw new HttpError(res.status, `Upstream request failed: ${res.status}`);
    }

    const text = await res.text();
    if (text.length > MAX_UPSTREAM_BYTES) {
      throw new HttpError(502, 'Upstream payload too large');
    }

    const cachedResponse = new Response(text, {
      status: res.status,
      headers: { 'content-type': 'application/json' },
    });
    if (ctx) ctx.waitUntil(cacheStore(cacheUrl, cachedResponse, getUpstreamCacheTtlSeconds(env)));

    return {
      data: JSON.parse(text) as T,
      bytesIn: text.length,
      upstreamUrl,
      fromCache: false,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'Failed to fetch upstream JSON');
  } finally {
    clearTimeout(timeout);
  }
}
