# workshop-md-converter

Cloudflare Worker that converts Workshop.code wiki JSON into agent-friendly Markdown.

## Features (V1)

- `GET /healthz`
- `GET /wiki/articles.md`
- `GET /wiki/articles/:slug.md`
- `Accept: text/markdown` negotiation on `/wiki/articles/:slug`
- Minimal content cleaning (no full HTML->Markdown rewrite)
- YAML front matter output
- Markdown error pages for 404/upstream failures

## Setup

```bash
pnpm install
pnpm test
pnpm run dev
```

## CI/CD Deployment

GitHub Actions automatically deploys to Cloudflare when code is pushed to `main`.

Workflow gates:

- `pnpm test`
- `pnpm run build`
- `pnpm run deploy`

Required GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN` (required)
- `CLOUDFLARE_ACCOUNT_ID` (recommended)

If deployment fails, check the workflow logs in GitHub Actions:
`Actions -> Deploy to Cloudflare -> latest run`.

## Environment

Configured via `wrangler.jsonc` vars:

- `UPSTREAM_BASE_URL`
- `UPSTREAM_ARTICLES_PATH`
- `RENDERER_VERSION`
- `CACHE_TTL_SECONDS`
- `PUBLIC_BASE_URL` (optional, preferred base URL for generated `.md` links)

## Notes

- JSON endpoints like `/wiki/articles.json` are bypassed and keep upstream behavior.
- Unknown upstream fields are preserved in `extra` during normalization.
- URI strategy is `slug-only`; id-based article paths return Markdown 404.
- All Workshop article links are normalized to proxy `.md` URLs.

## Route Contract (Slug-Only)

- Supported article routes:
  - `GET /wiki/articles/:slug.md`
  - `GET /wiki/articles/:slug` with `Accept: text/markdown`
- Numeric id article routes are not supported and must return Markdown 404:
  - `GET /wiki/articles/8507.md` must return Markdown 404.
  - `GET /wiki/articles/8507` with `Accept: text/markdown` must return Markdown 404.
- `Source` metadata always uses canonical slug-based workshop links (`/wiki/articles/:slug`) to avoid id-link fallback.

## License & Content Ownership

- This converter code is licensed under `AGPL-3.0-only` (see `LICENSE`).
- Workshop.codes wiki content rendered by this project is not part of this repository's codebase and is not re-licensed under this project's AGPL license.
- Use and redistribution of Workshop.codes content must follow Workshop.codes Terms of Service: <https://workshop.codes/tos>.
