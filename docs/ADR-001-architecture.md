# ADR-001: Cloudflare Worker JSON-to-Markdown Converter

## Decision
Use a custom Cloudflare Worker converter as the primary path for Workshop wiki JSON to Markdown rendering.

## Rationale
- JSON requires explicit field modeling and stable front matter.
- Existing article content may already be markdown and should be preserved.
- Response headers and cache behavior must be deterministic.
