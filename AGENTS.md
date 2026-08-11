# Workshop Cloudflare Markdown Converter: Agent Work Guide

> This file is the repository-wide entry point for coding agents. Keep cross-cutting rules here; keep detailed contracts and architecture decisions in the documents listed below.

## Repository Boundary

- This repository owns a TypeScript Cloudflare Worker that converts Workshop.codes wiki JSON into stable, agent-friendly Markdown.
- The Workshop.codes API and wiki content are upstream inputs. Do not modify upstream services, other repositories, or deployment state unless the user explicitly requests it.
- The Worker owns routing, upstream adaptation, minimal content cleaning, Markdown rendering, response metadata, and tests. It does not own the source article content.
- Inspect the current branch, worktree, and `git status` before editing. Preserve existing or concurrent user changes; do not reset, overwrite, or clean them.

## Rule Organization

- `AGENTS.md` contains rules that apply to every task in this repository.
- `README.md` is the user-facing route and behavior overview.
- `docs/TECH-SPEC.md` is the current V1 contract snapshot, including the slug-only article route contract.
- `docs/ADR-001-architecture.md` records the converter architecture and its rationale.
- `docs/SPEC-COVERAGE-REPORT.md` is an acceptance-coverage snapshot. Use it as evidence to audit, then verify the live code and tests rather than treating the dated status as authoritative.
- `package.json` and `wrangler.jsonc` are the sources of truth for local commands and Worker runtime configuration.
- `tools/check_slug_only_docs.sh` is the documentation guard for the slug-only route contract.
- Keep repository-wide rules here. Put directory-specific rules in a nested `AGENTS.md` only when a directory gains constraints that do not apply elsewhere.

## Current Contract

### Runtime and routes

- Use TypeScript and the Cloudflare Workers runtime.
- Markdown responses use `text/markdown; charset=utf-8`.
- Supported Markdown entry points are:
  - `GET /` for the onboarding Markdown page.
  - `GET /healthz` for the health response.
  - `GET /wiki/articles.md` for the article index.
  - `GET /wiki/articles/:slug.md` for an article.
  - `GET /wiki/articles/:slug` with `Accept: text/markdown` for content negotiation.
- Article routes are slug-only. Keep route, test, and documentation examples in that form; do not introduce alternate article-reference semantics.
- Existing `.json` requests bypass the Markdown renderer and remain upstream passthrough requests.

### Transformation and data boundaries

- Keep body conversion to minimal cleaning. Do not turn the article body into a general-purpose HTML-to-Markdown rewrite.
- Preserve existing Markdown structures, including headings, code blocks, tables, and lists. Remove unsafe or unwanted `style` and `script` content without flattening those structures.
- If upstream field names or shapes drift, adapt them in `src/source/workshop-adapter.ts` first. Keep renderer behavior stable.
- Preserve fields not mapped into the normalized article in `extra`.
- Keep the producer-to-consumer path explicit: upstream fetch → adapter/normalization → minimal cleaning → Markdown template → response headers and cache metadata.
- Preserve front matter, Markdown error pages, cache directives, ETag/Last-Modified behavior, and observability metadata when changing the rendering path.

## Acceptance Checks

- `curl /wiki/articles/hero-color-reference-table.md` returns Markdown with `text/markdown; charset=utf-8`.
- `curl /wiki/articles/hero-color-reference-table -H 'Accept: text/markdown'` returns the same Markdown-oriented article response.
- Article output includes core metadata in front matter.
- Cleaning removes `style` and `script` content without breaking code blocks, tables, headings, or lists.
- An unknown article returns a Markdown-formatted 404 response.
- The repository test suite passes for implementation changes.

## Task-to-Document Routing

- First contact with the repository, route behavior, or V1 scope: read `README.md`, `docs/TECH-SPEC.md`, and the relevant tests.
- Changes to route matching or `Accept` negotiation: read `src/index.ts`, `src/routes/markdown.ts`, `src/http/negotiate.ts`, and `test/unit/negotiate.test.ts` plus the article integration tests.
- Changes to upstream fields, fallback fetching, or unknown-field preservation: read `src/source/fetch-json.ts`, `src/source/normalize.ts`, `src/source/workshop-adapter.ts`, and `test/unit/workshop-adapter.test.ts`.
- Changes to body cleaning or link handling: read `src/transform/clean-html.ts`, `src/transform/normalize-links.ts`, the related unit tests, and `test/fixtures/article.expected.md`.
- Changes to front matter, index output, or response metadata: read `src/transform/markdown-template.ts`, `src/http/response.ts`, `src/http/cache-key.ts`, and the integration tests.
- Changes to runtime configuration or deployment behavior: read `wrangler.jsonc`, `src/env.ts`, `src/env.d.ts`, `package.json`, and `docs/ADR-001-architecture.md`.
- Changes to route examples or Markdown documentation: run `bash tools/check_slug_only_docs.sh` and keep all article references slug-only.

## General Workflow

1. Confirm the user goal, repository boundary, current branch, worktree, and clean or dirty state.
2. Read the smallest relevant documents, source files, and tests before deciding on an implementation.
3. Trace the affected behavior from upstream producer through adapter, renderer, and persisted or returned state. Do not infer business correctness from an HTTP status alone.
4. Make the narrowest change that satisfies the request. Avoid speculative refactors, new compatibility layers, or unrelated documentation changes.
5. Preserve the existing route and data contracts, especially minimal cleaning, Markdown structure, unknown fields in `extra`, and slug-only routes.
6. Run validation matched to the change, then review the complete diff and repository status.
7. Report what passed, what was not run, remaining risks, and any decision that still belongs to the user.

## Validation and Delivery

- `pnpm test` runs the repository test suite.
- `pnpm build` runs the Wrangler dry-run build and is required for runtime or deployment-related changes.
- `pnpm exec tsc --noEmit` is useful for TypeScript-only changes when a focused type check is sufficient.
- `bash tools/check_slug_only_docs.sh` is required after changing `README.md`, `AGENTS.md`, or route documentation.
- Before committing, run `git diff --check`, inspect the staged diff, and stage only files owned by the task.
- For implementation work, commit verified task-owned changes with a concise message. Do not push, amend, rewrite history, deploy, or publish without an explicit request.

## Absolute Safety Boundaries

- Never commit credentials, tokens, authorization files, private identifiers, runtime logs, or upstream secrets. Keep secrets in secure Worker or local environment configuration.
- Do not expose internal configuration or secret values in Markdown output, logs, tests, fixtures, or documentation.
- Do not use destructive Git or filesystem commands to discard user work. Prefer recoverable operations when a deletion is explicitly authorized.
- Treat `pnpm deploy` and other external state changes as separately authorized operations; a local build does not authorize deployment.
- When a change touches upstream compatibility, content safety, cache identity, or public response contracts, state the risk and verify the producer-to-consumer path before delivery.

## Scope Guardrails

- V1 includes the index and article Markdown routes, content negotiation, minimal cleaning, front matter, cache headers, Markdown error pages, observability metadata, tests, and README behavior documentation.
- V2+ work such as sectionizer upgrades, richer tokenization, webhook purge, or heterogeneous document fallback is out of scope unless explicitly requested.
