import { getCacheTtlSeconds } from '../core/config';
import type { Env } from '../env';

interface JsonResponseInput {
  body: string;
  env: Env;
  status?: number;
  etag?: string;
  cacheControl?: string;
  agentContentType?: string;
  sourceFormat?: string;
  upstream?: {
    upstreamUrl: string;
    bytesIn: number;
    fromCache: boolean;
  };
}

/**
 * JSON response with the standard manifest header set. `Vary` is deliberately
 * not set: the manifest is served as a single, un-negotiated media type.
 */
export function jsonResponse(input: JsonResponseInput): Response {
  const ttl = getCacheTtlSeconds(input.env);
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': input.cacheControl ?? `public, max-age=${ttl}, s-maxage=${ttl}`,
  });
  if (input.etag) headers.set('etag', input.etag);
  if (input.agentContentType) headers.set('x-agent-content-type', input.agentContentType);
  if (input.sourceFormat) headers.set('x-source-format', input.sourceFormat);
  if (input.upstream) {
    headers.set('x-upstream-url', input.upstream.upstreamUrl);
    headers.set('x-upstream-bytes', String(input.upstream.bytesIn));
    headers.set('x-upstream-cache', input.upstream.fromCache ? 'HIT' : 'MISS');
  }
  return new Response(input.body, {
    status: input.status ?? 200,
    headers,
  });
}
