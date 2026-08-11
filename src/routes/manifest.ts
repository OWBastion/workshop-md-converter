import type { Env } from '../env';
import { jsonResponse } from '../http/json-response';
import { fetchJson } from '../source/fetch-json';
import { normalizeWorkshopList } from '../source/normalize';
import { buildManifest } from '../transform/manifest';
import { sha256Hex } from '../utils/hash';
import { resolvePublicBaseUrl } from './markdown';

export type ManifestRouteKind = { kind: 'none' } | { kind: 'manifest' };

export function resolveManifestRoute(pathname: string): ManifestRouteKind {
  return pathname === '/manifest.json' ? { kind: 'manifest' } : { kind: 'none' };
}

export async function manifestRoute(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const publicBaseUrl = resolvePublicBaseUrl(request, env);
  const upstream = await fetchJson<Record<string, unknown>>(env, env.UPSTREAM_ARTICLES_PATH, ctx);
  const list = normalizeWorkshopList(upstream.data, publicBaseUrl, env.UPSTREAM_BASE_URL);
  const manifest = buildManifest(list);
  const body = JSON.stringify(manifest, null, 2);
  const etag = `"${await sha256Hex(body)}"`;
  return jsonResponse({
    body,
    env,
    etag,
    agentContentType: 'wiki-manifest',
    sourceFormat: 'workshop-json',
    upstream: {
      upstreamUrl: upstream.upstreamUrl,
      bytesIn: upstream.bytesIn,
      fromCache: upstream.fromCache,
    },
  });
}

export function manifestErrorResponse(status: number, title: string, message: string, _env: Env): Response {
  return Response.json(
    { error: { status, title, message } },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}
