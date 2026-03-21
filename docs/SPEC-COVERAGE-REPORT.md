# Workshop Cloudflare Agent Spec Coverage Report

Date: 2026-03-21

## Summary

- Status: partially implemented before this patch set; key gaps identified and addressed in this change.
- Scope basis: `workshop-cloudflare-agent-spec.md` V1 acceptance criteria and non-negotiable rules.

## Acceptance Criteria Mapping

1. `curl /wiki/articles/hero-color-reference-table.md` returns markdown
- Status: implemented
- Evidence: route resolution in `src/routes/markdown.ts`, integration tests in `test/integration/render-article.test.ts`.

2. `curl /wiki/articles/hero-color-reference-table -H 'Accept: text/markdown'` returns markdown
- Status: implemented
- Evidence: `src/http/negotiate.ts`, integration test `falls back to request origin when PUBLIC_BASE_URL is missing`.

3. Front matter includes core metadata
- Status: implemented
- Evidence: `src/transform/markdown-template.ts`, unit test `test/unit/markdown-template.test.ts`.

4. Code blocks/tables are not broken by cleaning
- Previous status: partial (table flattened)
- Current status: implemented
- Evidence: `src/transform/clean-html.ts` now preserves table markup; tests in `test/unit/clean-html.test.ts` and fixture match in `test/integration/render-article.test.ts`.

5. Style/script tags are removed
- Status: implemented
- Evidence: `stripStyleTags` in `src/transform/clean-html.ts`; tests in `test/unit/clean-html.test.ts`.

6. Missing article returns Markdown 404
- Status: implemented
- Evidence: `markdownErrorResponse` and 404 path in `src/index.ts`; integration test `returns markdown 404 for unknown slug article request`.

7. Test suite passes
- Status: implemented (verified in this session)

## Additional Spec Alignment

- Unknown upstream fields preserved in `extra`: implemented in `src/source/workshop-adapter.ts`.
- Slug-only route contract: implemented in routes/tests/docs.
- Observability fields gap (upstream URL, article slug, bytes in):
  - Previous status: partial
  - Current status: implemented via response telemetry headers and `logRequest` context in `src/index.ts`.
