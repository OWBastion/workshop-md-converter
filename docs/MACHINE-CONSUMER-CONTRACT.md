# Machine-Consumer Contract

Status: Implemented (`md.owbastion.codes`, issues #38 / #39 / #40)
Schema version: 1

This document is the stable contract for machine consumers — coding agents, evaluation harnesses, and retrieval tools — of `md.owbastion.codes`. It describes the endpoints, schemas, revision semantics, caching behavior, and error handling that consumers can rely on without inspecting Worker internals.

## 1. Purpose and neutrality

The backend is **model/harness-neutral**: it performs no search, ranking, embeddings, or vector indexing, and exposes no LLM/MCP endpoints. Search and ranking policy is entirely consumer-side, typically operating on the manifest locally.

## 2. Endpoints and content types

| Endpoint | Content type | Purpose |
| --- | --- | --- |
| `GET /manifest.json` | `application/json; charset=utf-8` | Compact document manifest (machine discovery) |
| `GET /wiki/articles.md` | `text/markdown; charset=utf-8` | Article index (list metadata only) |
| `GET /wiki/articles/:slug.md` | `text/markdown; charset=utf-8` | Exact document |
| `GET /wiki/articles/:slug` with `Accept: text/markdown` | `text/markdown; charset=utf-8` | Exact document (negotiated) |
| `GET /` | `text/markdown; charset=utf-8` | Human onboarding guide |
| `GET /healthz` | `text/plain; charset=utf-8` | Liveness |

Notes:

- Paths ending in `.md` are always served as Markdown regardless of `Accept`.
- Index and article routes without `.md` require `Accept: text/markdown`; otherwise the server returns a Markdown `406 Not Acceptable` page.
- Other `.json` paths (not `/manifest.json`) are passed through to the upstream origin untouched.

## 3. Manifest (`GET /manifest.json`)

Schema version: `schemaVersion: 1`. Breaking changes bump this value; additive fields are non-breaking.

```json
{
  "schemaVersion": 1,
  "documents": [
    {
      "title": "Hero Color Reference Table",
      "slug": "hero-color-reference-table",
      "category": "References",
      "markdownUrl": "https://md.example/wiki/articles/hero-color-reference-table.md",
      "sourceUrl": "https://workshop.codes/wiki/articles/hero-color-reference-table",
      "updatedAt": "2026-03-17T19:20:21.209Z",
      "aliases": ["Hero Color Reference Table", "hero-color-reference-table"]
    }
  ]
}
```

- `documents` is ordered deterministically by `slug` (ascending), so snapshots and diffs are reproducible.
- `markdownUrl` is the exact-document Markdown route (`/wiki/articles/:slug.md`), absolute against `PUBLIC_BASE_URL` (or the request origin).
- `sourceUrl` is the canonical upstream Workshop.codes page.
- `aliases` are conservative: `[title, slug]` deduplicated. No invented OverPy/OSTW aliases are emitted.
- Optional fields (`category`, `updatedAt`) are omitted when the upstream data does not provide them.
- The manifest is metadata-only. It never contains article bodies or content hashes: exact per-document hashes come from the article route (section 5–6). Manifest generation must never render or hash every article body (generation-cost boundary, see `docs/ADR-002-caching-strategy.md`).

## 4. Document identity and slug rules

- Document identity is the slug: `GET /wiki/articles/:slug.md`, or the negotiated `/wiki/articles/:slug`.
- Slugs are slug-only; there are no numeric-identifier route semantics.
- A trailing `.md` in the slug is normalized away.
- The manifest `slug` is identical to the slug used in `markdownUrl` and in the article front matter.

## 5. Exact Markdown documents

Article routes first request `/wiki/articles/:slug.json` from upstream; only on a 404 do they fall back to the full list (`/wiki/articles.json`) and match by slug. Missing documents produce a Markdown 404.

Article front matter (YAML):

```yaml
---
title: ...
description: ...
url: <markdownUrl>
source: workshop
slug: <slug>
category: ...
tags: [...]
created_at: ...
updated_at: ...
content_type: wiki-article
content_hash: <64-hex sha256>
---
```

- `updated_at` is the upstream source update time (there is no separate `source_updated_at`).
- `content_hash` is the SHA-256 hex of the rendered Markdown document excluding the `content_hash` line itself. Identical inputs always yield an identical hash; any change to the rendered document changes the hash.

## 6. Revision/hash semantics

- Article `ETag` is `"<content_hash>"` — the same value as the front-matter `content_hash`.
- Article `Last-Modified` is the HTTP date of `updated_at`, present only when the source provides an update time.
- Manifest `ETag` is `"<sha256 of the JSON body>"`. The manifest has no `Last-Modified`.
- Revision semantics are decoupled from the Worker deployment version: unchanged rendered content keeps a stable hash/ETag even when `RENDERER_VERSION` changes. A renderer change that alters output will change hashes — expected, and detectable via the hash.

## 7. Cache headers and conditional requests

Successful (200) responses:

- `Cache-Control: public, max-age=<ttl>, s-maxage=<ttl>` — `<ttl>` defaults to 300s (`CACHE_TTL_SECONDS`).
- Markdown responses also set `Vary: Accept`.
- Observability headers: `x-cache-status: HIT|MISS`, `x-cache-key: <pathname>::<variant>::<renderer-version>`, `x-upstream-cache: HIT|MISS`.

Conditional requests (articles and manifest):

- `If-None-Match: <etag>` matching the current ETag → `304 Not Modified` (empty body; ETag and Cache-Control retained). A stale ETag → full 200.
- `If-Modified-Since: <http-date>` (articles that carry `Last-Modified`) → 304 when the document was not modified since.

Server-side caching model:

- The Worker caches generated responses (articles, index, manifest) and upstream JSON in the Cloudflare Workers Cache API. Entries are PoP-local and may be evicted at any time; this is a performance cache, not a durable store. Consumers must treat HTTP headers (ETag, Cache-Control) as the cache contract and never rely on PoP state.

Status-specific cache policy:

| Status | Policy |
| --- | --- |
| 200 | Normal TTL (`CACHE_TTL_SECONDS`) |
| 404 | Short TTL (60s) |
| 406 / 5xx | `Cache-Control: no-store`, never cached |

## 8. Error behavior

| Condition | Status | Content type | Cache |
| --- | --- | --- | --- |
| Missing document | 404 | Markdown page (`# Article Not Found`) | Short TTL |
| Markdown-capable route without `.md` and without `Accept: text/markdown` | 406 | Markdown page | no-store |
| Upstream network/timeout failure (article/index) | 502 | Markdown page | no-store |
| Upstream 5xx (article/index) | Upstream status preserved (e.g. 500) | Markdown page | no-store |
| Upstream failure (manifest) | 502 | JSON `{ "error": { "status", "title", "message" } }` | no-store |

## 9. Compatibility and versioning

- The route surface (`/manifest.json`, `/wiki/articles.md`, `/wiki/articles/:slug.md`, and the negotiated variants) is stable and slug-only.
- Manifest schema changes are versioned via `schemaVersion`; breaking changes bump it.
- Front matter and manifest fields are additive: consumers must tolerate unknown keys. Removing or renaming an existing key is a breaking change.
- `RENDERER_VERSION` may change rendered output (and therefore content hashes); the hash semantics in section 6 define how consumers detect that.
- The set of documents and their slugs is defined by upstream Workshop.codes content and changes as that content changes; no stability guarantee is made for specific slugs beyond the upstream source.

## 10. Checked-in fixture

- `test/fixtures/manifest.example.json` — a small example manifest response (one document) used by contract tests and documentation. It is not a bulk content mirror; see the repository LICENSE and Workshop.codes Terms of Service for content boundaries.
