import { getCacheTtlSeconds } from '../core/config';
import type { Env } from '../env';

interface MarkdownResponseInput {
  markdown: string;
  tokens: number;
  etag: string;
  lastModified?: string;
  env: Env;
  status?: number;
  contentType?: string;
}

export function markdownResponse(input: MarkdownResponseInput): Response {
  const ttl = getCacheTtlSeconds(input.env);
  const headers = new Headers({
    'content-type': input.contentType ?? 'text/markdown; charset=utf-8',
    vary: 'Accept',
    'cache-control': `public, max-age=${ttl}, s-maxage=${ttl}`,
    etag: input.etag,
    'x-agent-content-type': 'wiki-article',
    'x-source-format': 'workshop-json',
    'x-markdown-tokens': String(input.tokens),
  });

  if (input.lastModified) {
    headers.set('last-modified', input.lastModified);
  }

  return new Response(input.markdown, {
    status: input.status ?? 200,
    headers,
  });
}
