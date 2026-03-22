import type { Env } from '../env';
import { markdownResponse } from '../http/response';
import { estimateTokens } from '../transform/tokens';
import { toFrontMatter } from '../utils/yaml';

function computeEtag(parts: string[]): string {
  const input = parts.join('::');
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `"${(hash >>> 0).toString(16)}"`;
}

export function homeRoute(pathname: string, env: Env): Response | undefined {
  if (pathname !== '/') return undefined;

  const markdown = [
    toFrontMatter({
      title: 'Workshop Markdown Converter Guide',
      content_type: 'guide',
      renderer_version: env.RENDERER_VERSION,
      generated_at: new Date().toISOString(),
    }),
    '',
    '# Workshop Markdown Converter',
    '',
    'Start here: `/wiki/articles.md`',
    '',
    '## Core Endpoints',
    '',
    '- `GET /healthz`',
    '- `GET /wiki/articles.md`',
    '- `GET /wiki/articles/:slug.md`',
    '- `GET /wiki/articles/:slug` with `Accept: text/markdown`',
    '',
    '## Quick Usage',
    '',
    '```bash',
    '# Root guide',
    'curl https://md.owbastion.codes/',
    '',
    '# Article index as markdown',
    'curl https://md.owbastion.codes/wiki/articles.md',
    '',
    '# Explicit markdown route',
    'curl https://md.owbastion.codes/wiki/articles/hero-color-reference-table.md',
    '',
    '# Content negotiation route',
    "curl https://md.owbastion.codes/wiki/articles/hero-color-reference-table \\",
    "  -H 'Accept: text/markdown'",
    '```',
    '',
    '## Behavior Notes',
    '',
    '- Markdown responses use `text/markdown; charset=utf-8`.',
    '- Route negotiation rules:',
    '  - Paths ending in `.md` are always treated as markdown routes.',
    '  - Non-`.md` article/index routes require `Accept: text/markdown`.',
    '- Errors are returned as markdown pages:',
    '  - `404` for missing articles.',
    '  - `406` for unacceptable requests on markdown-capable routes.',
    '  - `5xx` markdown errors for upstream/internal failures.',
    '- Article body conversion uses minimal cleaning only.',
    '- Existing markdown structures (headings, code blocks, tables, lists) are preserved.',
    '- `<style>` and `<script>` tags are removed from article content.',
    '- Cache and metadata headers are present, including `Cache-Control`, `ETag`, `Vary: Accept`, and `x-markdown-tokens`.',
    '',
  ].join('\n');

  return markdownResponse({
    markdown,
    tokens: estimateTokens(markdown),
    etag: computeEtag(['home', env.RENDERER_VERSION]),
    env,
  });
}
