# workshop-md-converter

Cloudflare Worker that converts Workshop.code wiki JSON into stable, agent-friendly Markdown for API consumers.

## Overview

This service provides Markdown-first wiki access with predictable routes and content negotiation.

## Available Endpoints

- `GET /` (Markdown onboarding guide)
- `GET /healthz`
- `GET /wiki/articles.md`
- `GET /wiki/articles/:slug.md`
- `GET /wiki/articles/:slug` with `Accept: text/markdown`

## Quick Usage

```bash
# Root onboarding guide
curl https://md.owbastion.codes/

# Article index as markdown
curl https://md.owbastion.codes/wiki/articles.md

# Explicit markdown route
curl https://md.owbastion.codes/wiki/articles/hero-color-reference-table.md

# Content negotiation route
curl https://md.owbastion.codes/wiki/articles/hero-color-reference-table \
  -H 'Accept: text/markdown'
```

## Output Behavior

- Responses are served as Markdown (`text/markdown; charset=utf-8`) on markdown routes and markdown-negotiated article routes.
- Article routes first try `/wiki/articles/:slug.json`; only on 404 they fall back to `/wiki/articles.json`. Index rendering remains list-only.
- Article output includes YAML front matter with core metadata.
- Body conversion uses minimal cleaning only.
- Existing markdown structures (such as headings, code blocks, tables, and lists) are preserved.
- `<style>` and `<script>` tags are removed.
- Missing articles return Markdown 404 pages.
- Upstream fetch failures return Markdown error pages.

## Maintainer Note

For local development and runtime configuration, use the repository scripts and `wrangler.jsonc` as the source of truth. This README is intentionally user-focused and omits internal deployment and CI details.

## License & Content Ownership

- This converter code is licensed under `AGPL-3.0-only` (see `LICENSE`).
- Workshop.codes wiki content rendered by this project is not part of this repository's codebase and is not re-licensed under this project's AGPL license.
- Use and redistribution of Workshop.codes content must follow Workshop.codes Terms of Service: <https://workshop.codes/tos>.
