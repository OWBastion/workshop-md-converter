# workshop-md-converter

Cloudflare Worker that converts Workshop.code wiki JSON into agent-friendly Markdown.

## Features (V1)

- `GET /healthz`
- `GET /wiki/articles.md`
- `GET /wiki/articles/:id.md`
- `GET /wiki/articles/:slug.md`
- `Accept: text/markdown` negotiation on `/wiki/articles/:id` and `/wiki/articles/:slug`
- Minimal content cleaning (no full HTML->Markdown rewrite)
- YAML front matter output
- Markdown error pages for 404/upstream failures

## Setup

```bash
pnpm install
pnpm test
pnpm run dev
```

## Environment

Configured via `wrangler.jsonc` vars:

- `UPSTREAM_BASE_URL`
- `UPSTREAM_ARTICLES_PATH`
- `RENDERER_VERSION`
- `CACHE_TTL_SECONDS`

## Notes

- JSON endpoints like `/wiki/articles.json` are bypassed and keep upstream behavior.
- Unknown upstream fields are preserved in `extra` during normalization.
