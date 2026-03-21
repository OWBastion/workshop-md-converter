#!/usr/bin/env bash
set -euo pipefail

shopt -s nullglob

FILES=(
  "README.md"
  "AGENTS.md"
  "workshop-cloudflare-agent-spec.md"
  "docs/"*.md
)

fail=0

echo "Checking slug-only route contract in docs..."

forbidden_hits="$(
  grep -nE '/wiki/articles/:id(\.md)?|GET[[:space:]]+/wiki/articles/:id(\.md)?|/wiki/articles/[0-9]+(\.md)?|id-based|numeric id|article_id' "${FILES[@]}" || true
)"
if [[ -n "${forbidden_hits}" ]]; then
  echo "Found forbidden id semantics in docs:"
  echo "${forbidden_hits}"
  fail=1
fi

if [[ "${fail}" -ne 0 ]]; then
  echo "Slug-only docs check failed."
  exit 1
fi

echo "Slug-only docs check passed."
