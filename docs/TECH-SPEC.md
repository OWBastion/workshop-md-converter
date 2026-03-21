# Technical Spec Snapshot

Primary specification sources:
- `README.md`
- `docs/ADR-001-architecture.md`
- this `docs/TECH-SPEC.md` snapshot

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
- `Source` metadata is canonicalized to slug links (`/wiki/articles/:slug`).
