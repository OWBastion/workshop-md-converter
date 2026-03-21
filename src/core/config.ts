import type { Env } from '../env';

export const DEFAULT_TIMEOUT_MS = 6000;
export const MAX_UPSTREAM_BYTES = 1_000_000;

export function getCacheTtlSeconds(env: Env): number {
  const parsed = Number(env.CACHE_TTL_SECONDS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 300;
  return Math.floor(parsed);
}

export function normalizeUpstreamUrl(env: Env): URL {
  const base = new URL(env.UPSTREAM_BASE_URL);
  const allowedHosts = new Set(['workshop.codes', 'www.workshop.codes']);
  if (!allowedHosts.has(base.hostname)) {
    throw new Error('UPSTREAM_BASE_URL host is not allowed');
  }
  return base;
}
