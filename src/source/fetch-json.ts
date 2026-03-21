import { DEFAULT_TIMEOUT_MS, MAX_UPSTREAM_BYTES, normalizeUpstreamUrl } from '../core/config';
import { HttpError } from '../core/errors';
import type { Env } from '../env';

export async function fetchJson<T>(env: Env, path: string): Promise<T> {
  const base = normalizeUpstreamUrl(env);
  const url = new URL(path, base);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new HttpError(res.status, `Upstream request failed: ${res.status}`);
    }

    const text = await res.text();
    if (text.length > MAX_UPSTREAM_BYTES) {
      throw new HttpError(502, 'Upstream payload too large');
    }

    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'Failed to fetch upstream JSON');
  } finally {
    clearTimeout(timeout);
  }
}
