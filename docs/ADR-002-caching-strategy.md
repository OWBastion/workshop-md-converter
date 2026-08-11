# ADR-002: Worker-Native Caching and Generation Strategy

Date: 2026-08-11
Status: Accepted

## Context

The converter runs as a stateless Cloudflare Worker. It fetches Workshop.Codes JSON on demand, normalizes and renders Markdown per request, and emits cache headers (including a cache-key header) — but it does not yet use the Workers Cache API, so repeated requests re-fetch and re-render unchanged content once header TTLs expire at the edge.

Issue #41 requires a minimal, Worker-native cache/generation model that:

- preserves the lightweight, stateless architecture;
- avoids repeated upstream fetch/normalize/render work once agent retrieval traffic is introduced;
- keeps generation on demand and bounded (no bulk rendering or hashing);
- adds no persistent storage (no KV/R2/D1/DO/Queues/Cron/Workflows).

## Decision

### 1. Upstream JSON caching

Workshop.Codes JSON subrequests (single-article JSON and list JSON) are stored in a named Cache API cache (`caches.open('workshop-md-converter')`), keyed by the absolute upstream URL:

| Upstream status | Behavior |
| --- | --- |
| 200 | Cached for `UPSTREAM_CACHE_TTL_SECONDS` (default 60s). |
| 404 | Cached for 60s (short TTL), so repeated misses on the article fallback path do not re-hit upstream. |
| 5xx / network error / timeout | Never cached. |

Existing safeguards are preserved: the 6s timeout, a new cheap `Content-Length` pre-check, and the existing hard post-read size bound (1 MB).

### 2. Generated response caching

Generated Markdown responses (article index and article routes) are stored in the same named cache under a synthetic key:

```text
https://cache.local/generated?key=<pathname>::markdown::<renderer-version>
```

- The canonical cache key is built by `buildCacheKey` and includes the renderer/schema revision, so a renderer bump changes keys without manual purging.
- Writes use `ctx.waitUntil()` and never block the response path.
- Hit/miss is observable via the `x-cache-status` response header (`HIT`/`MISS`) and the `cacheStatus` log field. Upstream cache state at generation time is exposed via `x-upstream-cache` (`HIT`/`MISS`).
- `Vary` is stripped from stored copies (the variant is already part of the key; the Cache API matches on headers named in `Vary`, and lookup uses a synthetic key without an `Accept` header) and re-added when serving, preserving existing content-negotiation behavior.
- The Cache API is PoP-local: entries exist only in the data center that served the request. It is a performance cache, not a durable global store; consumers must not treat it as the source of truth. Cached responses can be evicted at any time and are never required for correctness.

### 3. Generation-cost boundary

Generation stays on demand and bounded:

- `/wiki/articles.md` derives from list metadata only; it never renders or hashes article bodies.
- When the manifest endpoint lands (#38), it must operate on list metadata only and must not render every article or compute document content hashes. Exact document hashing belongs to the exact-document fetch/render path (#39).
- No embeddings, vector indexing, background crawler, or full-Wiki materialization in this issue or its successors.

### 4. Error/cache policy

| Response | Cache policy |
| --- | --- |
| 200 generated content | TTL = `CACHE_TTL_SECONDS` (default 300s). |
| 404 (generated/upstream) | Short TTL (60s), stored in the Cache API and advertised via `Cache-Control`. |
| 406 / 5xx (upstream/internal) | `Cache-Control: no-store`, never stored. |

Transient backend failures are therefore never served as cached normal content.

### 5. Resource-safety hardening

A `Content-Length` pre-check rejects responses larger than the 1 MB bound before the body is read, when the header is present and reliable. The existing hard post-read check is retained for every response.

## Storage boundary

No KV, R2, D1, Queues, Cron, Workflows, or Durable Objects are introduced. Persistent storage should only be reconsidered if production/M4 evidence shows that PoP-local generated caching plus consumer-side local caching is insufficient.

## Consequences

- Repeated requests within TTLs skip upstream fetch and re-render.
- Cache entries are per-PoP and may be evicted at any time; correctness never depends on them.
- A `RENDERER_VERSION` change naturally invalidates generated cache keys.
- Cache reads and writes are best-effort: a lookup failure degrades to a miss and a write failure is swallowed, so caching can never break serving.
- `#38` should consume this policy rather than inventing its own; `#39` hashes only exact normalized/rendered documents; `#40` documents the final cache/revision contract.
