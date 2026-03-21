# Technical Spec Snapshot

Primary specification source: `workshop-cloudflare-agent-spec.md`.

This repository implements V1 scope:
- `/wiki/articles.md`
- `/wiki/articles/:slug.md`
- `Accept: text/markdown` on slug path
- minimal cleaning
- proxy-domain `.md` link normalization (supports `PUBLIC_BASE_URL` with request-origin fallback)
- markdown error pages
- tests and README

## Route Contract (Slug-Only)

- Only slug article routes are supported:
  - `GET /wiki/articles/:slug.md`
  - `GET /wiki/articles/:slug` + `Accept: text/markdown`
- Numeric id article routes are always Markdown 404:
  - `GET /wiki/articles/8507.md` must return Markdown 404.
  - `GET /wiki/articles/8507` + `Accept: text/markdown` must return Markdown 404.
- `Source` metadata is canonicalized to slug links (`/wiki/articles/:slug`) even if upstream JSON exposes id-based URLs.
