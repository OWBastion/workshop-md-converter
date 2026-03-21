# Workshop Cloudflare Agent Implementation Guide

## Objective

Build and maintain a Cloudflare Worker that transforms Workshop.code wiki JSON into stable, agent-friendly Markdown.

## Non-Negotiable Rules

1. Use TypeScript and Cloudflare Workers runtime.
2. Output Markdown with `text/markdown; charset=utf-8`.
3. Keep the body conversion as **minimal cleaning only**.
4. Do **not** perform full HTML-to-Markdown rewrites of article bodies.
5. Preserve existing Markdown structures (headings, code blocks, tables, lists).
6. Support both explicit `.md` routes and `Accept: text/markdown` negotiation.
7. If upstream fields drift, adapt in `workshop-adapter` first; avoid changing renderer behavior.
8. Preserve unknown fields in `extra`.
9. Route docs are slug-only: do not include numeric-identifier article route semantics in code, tests, or documentation.

## Delivery Sequence

1. Project scaffold and runtime config.
2. Core interfaces (`Env`, `NormalizedArticle`, render types).
3. Route handling (`/healthz`, index/article markdown routes, accept negotiation).
4. Upstream fetch and adapter mapping.
5. Minimal cleaning pipeline.
6. Front matter + markdown template rendering.
7. Response headers, cache directives, ETag/Last-Modified.
8. Unit tests, integration tests, README.

## Acceptance Criteria

- `curl /wiki/articles/hero-color-reference-table.md` returns `text/markdown`.
- `curl /wiki/articles/hero-color-reference-table -H 'Accept: text/markdown'` returns markdown.
- Front matter includes core metadata.
- Code blocks/tables are not broken by cleaning.
- Style/script tags are removed.
- Missing article returns Markdown 404.
- Test suite passes.

## Scope Guardrails

- V1 includes index and article markdown rendering, negotiation, cache headers, markdown error pages, and tests.
- V2+ items (sectionizer upgrades, richer tokenization, webhook purge, heterogeneous document fallback) are out of scope unless explicitly requested.
